# Tool Contribution System

## Problem

The old model made the **config** the atomic unit of ownership. A config is scoped to a `domain + urlPattern` (unique constraint), so only one person could own the config for e.g. `x.com/home`. Any authenticated user who tried to create a config for an existing URL pattern got a 409 Conflict — they couldn't contribute at all. The only write operation available to non-owners was voting on existing tools.

This bottlenecked tool coverage. To get many tools on a site, one person had to maintain the entire config.

## Solution

The **tool** is now the atomic unit of ownership, not the config.

- A **config** defines the scope: `domain`, `urlPattern`, `title`, `description`. Created once, owned by whoever creates it.
- A **tool** is contributed independently to a config. Any authenticated user can add a tool to any existing config. Each tool has its own `contributor`.
- The config owner and the tool's contributor can both delete a tool.

This is modelled after how DefinitelyTyped works for npm — anyone can contribute type definitions to a package, even if they didn't create it.

---

## What Changed

### `tools` table (`packages/db/src/schema.ts`)

A new first-class `tools` table replaces the `tools jsonb` blob that lived on `configs`:

```ts
export const tools = pgTable(
  "tools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    configId: uuid("config_id")
      .notNull()
      .references(() => configs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    inputSchema: jsonb("input_schema").$type<Record<string, unknown>>().notNull(),
    annotations: jsonb("annotations").$type<Record<string, string>>(),
    execution: jsonb("execution").$type<ExecutionDescriptor>(),
    contributor: text("contributor").notNull(),
    verified: boolean("verified").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_tools_config_name").on(table.configId, table.name),
    index("idx_tools_config_id").on(table.configId),
    index("idx_tools_contributor").on(table.contributor),
  ],
).enableRLS();
```

Three columns were removed from `configs`:

| Column removed from `configs` | Replaced by                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| `tools jsonb`                 | Rows in the `tools` table                                                             |
| `verifiedTools jsonb`         | `tools.verified boolean` per row                                                      |
| `hasExecution integer`        | Derived: `EXISTS (SELECT 1 FROM tools WHERE config_id = ? AND execution IS NOT NULL)` |

### Data migration (`supabase/migrations/0007_tools_table.sql`)

Applied to production. The migration:

1. Creates the `tools` table with RLS enabled.
2. Backfills all existing tools from `configs.tools` JSONB, using `configs.contributor` as the tool contributor and `configs.verified_tools` to set the `verified` flag per tool.
3. Drops `configs_tools_size` constraint (referenced the now-removed column).
4. Drops `tools`, `verified_tools`, and `has_execution` from `configs`.

All 33 existing tools were migrated with no data loss.

### TypeScript types (`packages/db/src/types.ts`)

`contributor` added to `ToolDescriptor` as optional (set server-side from the auth token, not required in request bodies):

```ts
export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, string>;
  execution?: ExecutionDescriptor;
  contributor?: string;
}
```

### Validation schemas (`packages/db/src/validation.ts`)

- `tools` removed from `updateConfigSchema` — tools are no longer replaced in bulk via PATCH.
- New `addToolSchema` export (alias of `toolDescriptorSchema`) used by the new POST endpoint.
- New `AddToolInput` type exported.

### DB helpers (`apps/web/lib/db.ts`)

`rowToConfig` and `rowToVerifiedConfig` now take a second argument — an array of tool rows fetched separately — instead of reading a JSONB field off the config row.

A private `getToolsForConfigIds` helper batch-fetches all tool rows for a set of config IDs in a single query, avoiding N+1:

```ts
async function getToolsForConfigIds(
  configIds: string[],
): Promise<Map<string, (typeof tools.$inferSelect)[]>>;
```

| Function               | Change                                                                            |
| ---------------------- | --------------------------------------------------------------------------------- |
| `createConfig`         | Batch-inserts tools into `tools` table after inserting the config row             |
| `updateConfig`         | Only updates config metadata — all tools logic removed                            |
| `getConfigById`        | Fetches tool rows, passes to `rowToConfig`                                        |
| `lookupByDomain`       | `hasExecution` filter uses `EXISTS` subquery; batch-fetches tools                 |
| `listConfigs`          | `isVerified` uses `EXISTS (... WHERE verified = true)`; batch-fetches tools       |
| `deleteToolFromConfig` | `DELETE FROM tools WHERE config_id = ? AND name = ?` — no more JSONB manipulation |
| `getStats`             | `totalTools` is `COUNT(*) FROM tools`                                             |
| `getLeaderboard`       | Queries `tools` grouped by contributor; `configCount` via correlated subquery     |

New function:

```ts
async function addToolToConfig(
  configId: string,
  tool: AddToolInput,
  contributor: string,
): Promise<ToolDescriptor | null>;
// Returns null if the tool name is already taken in this config (ON CONFLICT DO NOTHING)
```

### New endpoint: `POST /api/configs/:id/tools`

**File**: `apps/web/app/api/configs/[id]/tools/route.ts`

```
POST /api/configs/:id/tools
Authorization: Bearer <api-key>
Body: { name, description, inputSchema, annotations?, execution? }
```

- Open to **any authenticated user** — no ownership check on the config.
- Validates with `addToolSchema`.
- Sets `contributor` from the authenticated user's name.
- Returns `201` with the created tool, or `409` if the tool name is already taken in this config.

### Updated: `DELETE /api/configs/:id/tools/:toolName`

**File**: `apps/web/app/api/configs/[id]/tools/[toolName]/route.ts`

Previously only the config owner could delete tools. Now the tool's own contributor can also delete it:

```ts
const isConfigOwner = userName === existing.contributor;
const isToolContributor = userName === tool.contributor;

if (!isConfigOwner && !isToolContributor) {
  return 403;
}
```

### Updated: `PATCH /api/configs/:id`

No code changes needed in the route itself — removing `tools` from `updateConfigSchema` was sufficient. The PATCH endpoint now only accepts config-level metadata: `title`, `description`, `pageType`, `urlPattern`, `tags`.

### MCP server (`packages/mcp-server/src/tools.ts` + `hub-client.ts`)

Three changes:

**`upload_config` 409 message** updated from:

> "Use `update_config` to modify it."

To:

> "Use `contribute_tool` to add a tool to it, or `update_config` to update metadata."

**`update_config`** — `tools` parameter removed. The tool now only accepts metadata fields and its description reflects that.

**New `contribute_tool` MCP tool** — add a single tool to any existing config without needing ownership:

```
contribute_tool
  configId:    string  — the config to add to (from lookup_config or list_configs)
  name:        string  — kebab-case verb, e.g. "search-tweets"
  description: string  — what the tool does and when to use it
  inputSchema: object  — JSON Schema object
  annotations: object  — optional hints (readOnlyHint, destructiveHint, etc.)
  execution:   object  — optional CSS selector metadata for Chrome extension
```

Returns 409 if the tool name is already taken in that config.

### Web UI

**`apps/web/app/configs/[id]/page.tsx`**

- Each tool card now shows `by {tool.contributor}`.
- Delete button is visible to the config owner **or** the tool's contributor (was config owner only).

**`apps/web/app/domains/[domain]/page.tsx`**

- Same per-tool contributor display.

---

## What Stayed the Same

- `configVotes` table — keeps `(config_id, tool_name)` composite key. Still works correctly. Can migrate to a `tool_id` UUID FK in a future cleanup pass.
- Extension (`apps/extension/src/lib/hub-client.ts`) — calls `lookupConfig` which returns the same `WebMcpConfig` shape. No changes needed.
- URL pattern matching (`packages/db/src/url-matching.ts`) — operates on configs only, unaffected.
- The unique constraint on `configs (domain, url_pattern)` — intentionally kept. One config defines the scope for a URL; tools pile onto it.
- RLS — `tools` table has `enableRLS()` matching the pattern of all other tables. The app connects as the `postgres` role which bypasses RLS. No explicit policies are needed.

---

## Problems Solved

| Problem                                           | Before                                     | After                                          |
| ------------------------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| User 2 can't add tools to an existing config      | 403 on PATCH, 409 on POST                  | `POST /api/configs/:id/tools` open to any user |
| One person owns all tools for a URL               | Config owner controls everything           | Each tool has its own `contributor`            |
| Adding a tool requires knowing all existing tools | Full array replacement via `update_config` | Single `contribute_tool` call                  |
| Tool deletion requires config ownership           | Owner-only                                 | Tool contributor OR config owner               |
| "All tools by user X" query                       | Full table scan + JSONB parse              | `SELECT * FROM tools WHERE contributor = ?`    |
| `verifiedTools` is a duplicate JSONB copy         | Two copies must stay in sync               | Single `verified` boolean per tool row         |
| Leaderboard credits config owners for all tools   | One person gets all credit                 | Each tool credited to its actual contributor   |
| JSONB array grows unboundedly                     | Blob per config                            | Indexed rows, independently pageable           |
