# Tool Contribution System — Planned Changes

## Problem

The current model makes the **config** the atomic unit of ownership. A config is scoped to a `domain + urlPattern` (unique constraint), so only one person can own the config for e.g. `x.com/home`. Any authenticated user who tries to create a config for an existing URL pattern gets a 409 Conflict — they can't contribute at all. The only write operations available to non-owners are voting on existing tools.

This bottlenecks tool coverage. To get many tools on a site, you need one person to maintain the entire config.

## Solution

Make the **tool** the atomic unit of ownership, not the config.

- A **config** defines the scope: `domain`, `urlPattern`, `title`, `description`. Created once, owned by whoever creates it.
- A **tool** is contributed independently to a config. Any authenticated user can add a tool to any existing config. Each tool has its own `contributor`.
- The config owner and the tool's contributor can both delete a tool.

This is modelled after how DefinitelyTyped works for npm — anyone can contribute type definitions to a package, even if they didn't create it.

---

## Step-by-Step Implementation

### Step 1 — New `tools` table

**File**: `packages/db/src/schema.ts`

Add a new `tools` table:

```ts
export const tools = pgTable(
  "tools",
  {
    id:          uuid("id").primaryKey().defaultRandom(),
    configId:    uuid("config_id").notNull().references(() => configs.id, { onDelete: "cascade" }),
    name:        text("name").notNull(),
    description: text("description").notNull(),
    inputSchema: jsonb("input_schema").$type<Record<string, unknown>>().notNull(),
    annotations: jsonb("annotations").$type<Record<string, string>>(),
    execution:   jsonb("execution").$type<ExecutionDescriptor>(),
    contributor: text("contributor").notNull(),
    verified:    boolean("verified").default(false).notNull(),
    createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:   timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_tools_config_name").on(table.configId, table.name),
    index("idx_tools_config_id").on(table.configId),
    index("idx_tools_contributor").on(table.contributor),
  ],
).enableRLS();
```

Remove these three columns from the `configs` table — they are replaced by the new table:

| Column removed from `configs` | Replaced by |
|---|---|
| `tools jsonb` | Rows in the `tools` table |
| `verifiedTools jsonb` | `tools.verified boolean` per row |
| `hasExecution integer` | Derived: `EXISTS (SELECT 1 FROM tools WHERE config_id = ? AND execution IS NOT NULL)` |

**Why**: Tools get identity (UUID), attribution (per-tool `contributor`), and a first-class verified flag. The JSONB blob no longer grows unboundedly. Queries like "all tools by user X" become a simple indexed lookup.

---

### Step 2 — Data migration

**File**: New Drizzle migration SQL file

1. Create the `tools` table.
2. For each existing config row, read `configs.tools` JSONB array and insert one row per tool. Use `configs.contributor` as the tool contributor (no per-tool contributor data exists in the old model).
3. For each tool that appears in `configs.verified_tools`, set `verified = true` on the corresponding row.
4. Drop `configs.tools`, `configs.verified_tools`, `configs.has_execution`.

Migration SQL sketch:

```sql
-- Backfill tools from existing JSONB data
INSERT INTO tools (config_id, name, description, input_schema, annotations, execution, contributor, verified)
SELECT
  c.id,
  t->>'name',
  t->>'description',
  t->'inputSchema',
  t->'annotations',
  t->'execution',
  c.contributor,
  (c.verified_tools ? (t->>'name'))
FROM configs c, jsonb_array_elements(c.tools) AS t;

-- Drop replaced columns
ALTER TABLE configs DROP COLUMN tools;
ALTER TABLE configs DROP COLUMN verified_tools;
ALTER TABLE configs DROP COLUMN has_execution;
```

**Why**: All existing data is preserved. Every existing tool is migrated with the config owner as its contributor, which is correct — they were the ones who submitted it.

---

### Step 3 — Update TypeScript types

**File**: `packages/db/src/types.ts`

Add `contributor` to `ToolDescriptor` (optional so existing callers don't break immediately):

```ts
export interface ToolDescriptor {
  name:         string;
  description:  string;
  inputSchema:  Record<string, unknown>;
  annotations?: Record<string, string>;
  execution?:   ExecutionDescriptor;
  contributor?: string; // set by the server from auth token, not required in submissions
}
```

`WebMcpConfig.verified` and `WebMcpConfig.verifiedToolNames` stay the same shape — they're now derived from `tools.verified` rows instead of the JSONB map.

---

### Step 4 — Update DB helper functions

**File**: `apps/web/lib/db.ts`

Every function that currently reads `row.tools` (a JSONB field) now does a JOIN against the `tools` table.

`rowToConfig` changes from reading an array off the config row to assembling from joined tool rows:

```ts
// Before
function rowToConfig(row) {
  return { ...row, tools: row.tools }
}

// After
function rowToConfig(configRow, toolRows) {
  return {
    ...configRow,
    tools: toolRows.map(t => ({
      name:        t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: t.annotations ?? undefined,
      execution:   t.execution ?? undefined,
      contributor: t.contributor,
    })),
    verified: toolRows.length > 0 && toolRows.every(t => t.verified),
    verifiedToolNames: toolRows.filter(t => t.verified).map(t => t.name),
  }
}
```

Functions that change:

| Function | Change |
|---|---|
| `createConfig` | After inserting the config row, batch-insert all tools into the `tools` table |
| `updateConfig` | Now only updates config metadata (title, description, pageType, tags). Tools array replacement is removed |
| `getConfigById` | JOIN with `tools` table |
| `lookupByDomain` | JOIN with `tools` table |
| `listConfigs` | JOIN or count subquery against `tools` table |
| `deleteToolFromConfig` | `DELETE FROM tools WHERE config_id = ? AND name = ?` — no more JSONB manipulation |

New function:

```ts
async function addToolToConfig(configId: string, tool: ToolDescriptor, contributor: string) {
  // INSERT INTO tools (...) ON CONFLICT (config_id, name) DO NOTHING (or error)
  // Returns inserted tool or null if name already taken in this config
}
```

**Why**: `deleteToolFromConfig` previously did string manipulation on a JSONB array — fragile. Now it is a single indexed `DELETE`. Inserts are the same. JOINs are properly indexed via `idx_tools_config_id`.

---

### Step 5 — New endpoint: add a tool

**File**: `apps/web/app/api/configs/[id]/tools/route.ts` (new file)

```
POST /api/configs/:id/tools
Authorization: Bearer <api-key>
Body: { name, description, inputSchema, annotations?, execution? }
```

- Requires authentication (any valid API key — not just the config owner)
- Validates the body with `toolDescriptorSchema`
- Checks the tool name is not already taken in this config (409 if taken)
- Sets `contributor` from the authenticated user's GitHub username (from the auth token)
- Returns the created tool row

**No ownership check.** Any authenticated user can add a tool to any config.

**Why this is the key unlock**: Previously User 2 had no write path at all. Now they can `GET /api/configs/lookup?domain=x.com&url=x.com/home` to find the config, then `POST /api/configs/{id}/tools` to contribute. The 409 response on `POST /api/configs` already returns `existingId`, so User 2 always has the config ID they need.

---

### Step 6 — Update `DELETE /api/configs/:id/tools/:toolName`

**File**: `apps/web/app/api/configs/[id]/tools/[toolName]/route.ts`

Current authorization: only config owner can delete.

New authorization: config owner **or** the tool's own contributor:

```ts
const tool = await getToolByName(configId, toolName);
const isConfigOwner = config.contributor === userName;
const isToolContributor = tool?.contributor === userName;

if (!isConfigOwner && !isToolContributor) {
  return 403;
}
```

**Why**: User 2 should be able to remove their own broken tool without needing User 1's permission. User 1 (config owner) retains the ability to clean up any tool on their config.

---

### Step 7 — Update `PATCH /api/configs/:id`

**File**: `apps/web/app/api/configs/[id]/route.ts`

Remove `tools` from the accepted body. The PATCH endpoint now only updates config-level metadata:
- `title`
- `description`
- `pageType`
- `tags`
- `urlPattern`

Tools are no longer replaced in bulk — they are added and removed individually via the tools endpoints.

---

### Step 8 — Update validation schemas

**File**: `packages/db/src/validation.ts`

Remove `tools` from `updateConfigSchema`:

```ts
export const updateConfigSchema = z.object({
  urlPattern:  z.string()...,
  pageType:    z.string()...,
  title:       z.string()...,
  description: z.string()...,
  // tools removed — use POST /api/configs/:id/tools instead
  tags:        z.array(z.string())...,
});
```

Add `addToolSchema` for the new endpoint (same as `toolDescriptorSchema` but without a contributor field — that comes from the auth token):

```ts
export const addToolSchema = toolDescriptorSchema; // contributor is set server-side
```

---

### Step 9 — Update the MCP server

**File**: `packages/mcp-server/src/tools.ts`

Three changes:

**A. `upload_config` 409 message** — Change the response from:
> "Use `update_config` to modify it."

To:
> "Use `contribute_tool` to add a tool to it, or `update_config` to update metadata."

**B. `update_config`** — Remove the `tools` parameter. It now only accepts metadata fields (title, description, pageType, tags). Update the description accordingly.

**C. New `contribute_tool` MCP tool**:

```
contribute_tool — Add a single tool to an existing config. Any authenticated user can
contribute tools to any config, not just the config owner.

Parameters:
  configId:    string  — the config to add to (from lookup_config or list_configs)
  name:        string  — kebab-case verb, e.g. "search-tweets"
  description: string  — what the tool does and when to use it
  inputSchema: object  — JSON Schema object
  annotations: object  — optional hints (readOnlyHint, destructiveHint, etc.)
  execution:   object  — optional CSS selector metadata for Chrome extension
```

This replaces the old pattern of "fetch config → rebuild full tools array → call `update_config`". That pattern required knowing every existing tool name and was the only way to add a tool even for the config owner. Now it is a single targeted call.

**Why**: The MCP server is the primary interface for AI agents contributing configs. Getting `contribute_tool` right here means agents can add tools to any site's config conversationally without needing ownership.

---

### Step 10 — Update the leaderboard

**File**: `apps/web/app/api/leaderboard/route.ts` + `apps/web/lib/db.ts`

Current `toolCount` calculation: `SUM(jsonb_array_length(configs.tools))` — credits all tools to the config owner.

New calculation: join against the `tools` table and count by `tools.contributor`:

```sql
SELECT contributor, COUNT(*) as tool_count
FROM tools
GROUP BY contributor
ORDER BY tool_count DESC
```

**Why**: User 2 who contributes 50 tools across 10 different configs should appear on the leaderboard for those 50 tools, not have them credited to the config owners.

---

### Step 11 — Update the web UI

**File**: `apps/web/app/configs/[id]/page.tsx`

- Show `by {tool.contributor}` on each tool card (currently only shown at config level)
- Change `DeleteToolButton` visibility: show for config owner **or** the tool's contributor

```ts
// Before
const isOwner = session?.user?.name === config.contributor;
// show delete button only for isOwner

// After
const isConfigOwner = session?.user?.name === config.contributor;
const canDeleteTool = (tool) =>
  isConfigOwner || session?.user?.name === tool.contributor;
// show delete button when canDeleteTool(tool)
```

Also update `apps/web/app/domains/[domain]/page.tsx` — same per-tool contributor display.

---

## What stays the same

- `configVotes` table — keeps `(config_id, tool_name)` composite key. Still works correctly. Can migrate to a `tool_id` UUID FK in a future cleanup pass.
- Extension (`apps/extension/src/lib/hub-client.ts`) — calls `lookupConfig` which returns the same `WebMcpConfig` shape. No changes needed.
- URL pattern matching (`packages/db/src/url-matching.ts`) — operates on configs only, unaffected.
- The unique constraint on `configs (domain, url_pattern)` — intentionally kept. One config defines the scope for a URL; tools pile onto it.
- Rate limiting, auth, RLS policies — same patterns, just applied to the new endpoint.

---

## Implementation Order

1. Step 1 — schema (`packages/db/src/schema.ts`)
2. Step 2 — data migration SQL
3. Step 3 — TypeScript types (`packages/db/src/types.ts`)
4. Step 8 — validation schemas (`packages/db/src/validation.ts`)
5. Step 4 — DB helpers (`apps/web/lib/db.ts`)
6. Step 5 — new `POST /api/configs/:id/tools` endpoint
7. Step 6 — update `DELETE` endpoint
8. Step 7 — update `PATCH` endpoint
9. Step 9 — MCP server (`packages/mcp-server/src/tools.ts`)
10. Step 10 — leaderboard
11. Step 11 — web UI

---

## Problems Solved Summary

| Problem | Before | After |
|---|---|---|
| User 2 can't add tools to an existing config | 403 on PATCH, 409 on POST | `POST /api/configs/:id/tools` open to any user |
| One person owns all tools for a URL | Config owner controls everything | Each tool has its own `contributor` |
| Adding a tool requires knowing all existing tools | Full array replacement via `update_config` | Single `contribute_tool` call |
| Tool deletion requires config ownership | Owner-only | Tool contributor OR config owner |
| "All tools by user X" query | Full table scan + JSONB parse | `SELECT * FROM tools WHERE contributor = ?` |
| `verifiedTools` is a duplicate JSONB copy | Two copies must stay in sync | Single `verified` boolean per tool row |
| Leaderboard credits config owners for all tools | One person gets all credit | Each tool credited to its actual contributor |
| JSONB array grows unboundedly | Blob per config | Indexed rows, independently pageable |
