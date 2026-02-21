# Contributing to WebMCP Hub

There are two ways to contribute: **submit configs** for websites (the main use case) or **improve the hub itself** (code, docs, infrastructure).

---

## Contributing Configs

A config teaches AI agents how to interact with a website — what tools are available, what parameters they accept, and optionally how to execute them in the browser.

### Prerequisites

You need an API key for write operations. All read endpoints are public.

1. Sign in with GitHub at the hub (locally: `http://localhost:3000`)
2. Go to **Settings** → create a new API key
3. Save the key (starts with `whub_`)

### Via REST API

**Create a config:**

```bash
curl -X POST https://webmcp-hub.com/api/configs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer whub_your_api_key" \
  -d @config.json
```

**Update an existing config:**

```bash
curl -X PATCH https://webmcp-hub.com/api/configs/CONFIG_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer whub_your_api_key" \
  -d '{ "title": "Updated title", "tools": [ ... ] }'
```

**Look up configs (no auth needed):**

```bash
# All configs for a domain
curl https://webmcp-hub.com/api/configs/lookup?domain=github.com

# Configs matching a specific page
curl "https://webmcp-hub.com/api/configs/lookup?domain=github.com&url=github.com/search"

# Only executable configs (with CSS selector metadata)
curl "https://webmcp-hub.com/api/configs/lookup?domain=github.com&executable=true"

# Browse all configs
curl "https://webmcp-hub.com/api/configs?search=search&tag=devtools&page=1&pageSize=20"
```

**Full API reference:**

| Method  | Path                  | Auth | Description                                        |
| ------- | --------------------- | ---- | -------------------------------------------------- |
| `GET`   | `/api/configs`        | No   | List configs (`search`, `tag`, `page`, `pageSize`) |
| `POST`  | `/api/configs`        | Yes  | Create config (409 if domain+urlPattern exists)    |
| `GET`   | `/api/configs/lookup` | No   | Lookup by domain (`domain`, `url`, `executable`)   |
| `GET`   | `/api/configs/:id`    | No   | Get config by ID                                   |
| `PATCH` | `/api/configs/:id`    | Yes  | Update config (auto-increments version)            |
| `GET`   | `/api/stats`          | No   | Hub statistics                                     |

### Via MCP Server

If you use any MCP client, the hub exposes tools for reading (`lookup_config`, `list_configs`) and writing (`upload_config`, `update_config`, `vote_on_config`).

**Option A: Remote MCP server (no setup needed):**

Add to your MCP client config:

```json
{
  "mcpServers": {
    "web-mcp-hub": {
      "command": "npx",
      "args": ["mcp-remote", "https://webmcp-hub-mcp.flowagentlyhub.workers.dev/mcp"]
    }
  }
}
```

**Option B: Local MCP server (for development):**

```json
{
  "mcpServers": {
    "web-mcp-hub": {
      "command": "node",
      "args": ["path/to/packages/mcp-server/dist/index.js", "--stdio"],
      "env": {
        "HUB_URL": "http://localhost:3000",
        "HUB_API_KEY": "whub_your_api_key"
      }
    }
  }
}
```

Then ask your AI agent to contribute or update configs.

### Via Playwright WebMCP Hub (agent workflow)

When using the Playwright WebMCP Hub proxy, agents contribute using a simple two-step flow:

**Step 1 — Create a config shell:**

```
contribute_create-config({
  domain: "example.com",
  urlPattern: "example.com/tasks",
  title: "Task Manager",
  description: "Create, list, and delete tasks"
})
→ "Config created! ID: abc123"
```

**Step 2 — Add tools one at a time:**

```
contribute_add-tool({
  configId: "abc123",
  name: "search-tasks",
  description: "Search tasks by keyword",
  selector: "#searchForm",
  autosubmit: true,
  submitSelector: "#searchBtn",
  submitAction: "click",
  fields: [{ type: "text", selector: "#searchInput", name: "query", description: "Search term" }],
  resultSelector: ".results li",
  resultExtract: "list"
})
→ "Tool added!"
```

Call `contribute_add-tool` once for each tool. The `inputSchema` and `execution` objects are built automatically from the flat fields — no nested JSON to construct.

### Config Structure

```jsonc
{
  // Required
  "domain": "example.com",                  // Normalized domain (no protocol)
  "urlPattern": "example.com/tasks",         // URL scope (see patterns below)
  "title": "Example Task Manager",           // Human-readable name
  "description": "Manage tasks on Example",  // What agents can do
  "contributor": "your-github-username",      // Who you are
  "tools": [ ... ],                          // Tool array (can be empty initially)

  // Optional
  "tags": ["productivity", "tasks"],         // For search/categorization
  "pageType": "form"                         // search, form, dashboard, feed, etc.
}
```

### URL Pattern Types

Configs are scoped to URL paths. The extension and `lookup_config` use pattern matching to return only relevant configs.

| Pattern                 | Matches                            | Use for                    |
| ----------------------- | ---------------------------------- | -------------------------- |
| `example.com`           | All pages on the domain            | Global tools (nav, search) |
| `example.com/dashboard` | Only `/dashboard` exactly          | Page-specific tools        |
| `example.com/users/:id` | `/users/alice`, `/users/123`, etc. | Dynamic pages              |
| `example.com/admin/**`  | `/admin` and everything under it   | Section-wide tools         |

Best practice: create separate configs for different sections rather than one catch-all.

### Tool Structure

Each tool in the `tools` array:

```json
{
  "name": "search-products",
  "description": "Search products by keyword and category",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search keyword" },
      "category": { "type": "string", "description": "Product category" }
    },
    "required": ["query"]
  },
  "annotations": {
    "readOnlyHint": "true"
  }
}
```

Rules:

- **name** — kebab-case with a verb: `search-products`, `add-to-cart`, `delete-item`
- **inputSchema** — valid JSON Schema. Every property must be an object with at least `"type"`. Never use raw values like `{"query": 200}` or `{"query": "string"}`
- **annotations** — optional hints: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`

### Execution Metadata (optional)

Add `execution` to a tool to make it runnable by the Chrome extension via CSS selectors. Two modes:

**Simple mode** — fill form fields and submit:

```json
{
  "name": "search-products",
  "description": "Search the product catalog",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search term" }
    },
    "required": ["query"]
  },
  "execution": {
    "selector": "#searchForm",
    "fields": [
      {
        "type": "text",
        "selector": "#searchInput",
        "name": "query",
        "description": "Search input field"
      }
    ],
    "autosubmit": true,
    "submitAction": "click",
    "submitSelector": "#searchBtn",
    "resultSelector": ".results-list li",
    "resultExtract": "list"
  }
}
```

**Multi-step mode** — a `steps[]` array for complex workflows:

```json
{
  "name": "create-issue",
  "description": "Create a new issue with title and body",
  "inputSchema": {
    "type": "object",
    "properties": {
      "title": { "type": "string", "description": "Issue title" },
      "body": { "type": "string", "description": "Issue description" }
    },
    "required": ["title"]
  },
  "execution": {
    "selector": "body",
    "autosubmit": false,
    "steps": [
      { "action": "click", "selector": "button.new-issue" },
      { "action": "wait", "selector": "#title-input", "state": "visible" },
      { "action": "fill", "selector": "#title-input", "value": "{{title}}" },
      { "action": "fill", "selector": "#body-input", "value": "{{body}}" },
      { "action": "click", "selector": "button[type=submit]" },
      { "action": "wait", "selector": ".issue-created", "state": "visible" },
      { "action": "extract", "selector": ".issue-created", "extract": "text" }
    ]
  }
}
```

Step actions: `navigate`, `click`, `fill`, `select`, `wait`, `extract`, `scroll`, `condition`.
Use `{{paramName}}` for parameter interpolation in `url`, `value`, and `selector` fields.

### Complete Example

A config for a task management app with executable tools:

```json
{
  "domain": "example.com",
  "urlPattern": "example.com/tasks",
  "title": "Task Manager",
  "description": "Create, list, and delete tasks on the example app",
  "contributor": "agent",
  "tags": ["productivity", "tasks"],
  "tools": [
    {
      "name": "add-task",
      "description": "Add a new task",
      "inputSchema": {
        "type": "object",
        "properties": {
          "title": { "type": "string", "description": "Task title" }
        },
        "required": ["title"]
      },
      "execution": {
        "selector": "#taskForm",
        "autosubmit": true,
        "fields": [
          {
            "type": "text",
            "selector": "#titleInput",
            "name": "title",
            "description": "Task title field"
          }
        ]
      }
    },
    {
      "name": "list-tasks",
      "description": "List all current tasks",
      "inputSchema": { "type": "object", "properties": {} },
      "annotations": { "readOnlyHint": "true" },
      "execution": {
        "selector": "#taskList",
        "autosubmit": false,
        "resultSelector": "#taskList li",
        "resultExtract": "list"
      }
    },
    {
      "name": "delete-task",
      "description": "Delete a task by its title",
      "inputSchema": {
        "type": "object",
        "properties": {
          "target": { "type": "string", "description": "Title of the task to delete" }
        },
        "required": ["target"]
      },
      "annotations": { "destructiveHint": "true" },
      "execution": {
        "selector": "li:has-text(\"{{target}}\") .delete-btn",
        "autosubmit": true
      }
    }
  ]
}
```

---

## Contributing Code

Want to improve the hub itself? Here's how to get started.

### Getting Started

1. Fork the repository
2. Clone your fork and install dependencies:

```bash
git clone https://github.com/<your-username>/web-mcp-hub.git
cd web-mcp-hub
npm install
cp .env.local.example .env.local
```

3. Set up the database (see [README](README.md#setup))
4. Start the dev server:

```bash
npm run dev
```

### Development Workflow

1. Create a branch from `main`:

```bash
git checkout -b feat/my-feature
```

2. Make your changes
3. Run linting and formatting before committing:

```bash
npm run lint:fix
npm run format
```

4. Commit with a descriptive message (see below)
5. Push and open a pull request

### Commit Messages

Use short, descriptive commit messages in imperative mood:

- `add lookup endpoint caching`
- `fix domain normalization for ports`
- `update tool descriptor validation`

Prefix with a scope when helpful: `db: add index on tags`, `extension: handle navigation errors`.

### Code Style

- TypeScript strict mode everywhere
- ESLint and Prettier are configured — run `npm run lint:fix && npm run format` to auto-fix
- Double quotes, semicolons, 2-space indentation, trailing commas
- Prefer explicit types over `any` — suppress with `eslint-disable` only when truly necessary

### Project Structure

| Directory             | What lives there                            |
| --------------------- | ------------------------------------------- |
| `apps/web`            | Next.js hub UI + REST API                   |
| `apps/extension`      | Chrome extension (WXT)                      |
| `packages/db`         | Shared schema, types, validation, DB client |
| `packages/mcp-server` | MCP server (stdio + HTTP)                   |
| `supabase/migrations` | SQL migrations generated by Drizzle         |

### Database Changes

When modifying the schema:

1. Edit `packages/db/src/schema.ts`
2. Run `npm run db:generate` to create a migration
3. Review the generated SQL in `supabase/migrations/`
4. Commit both the schema change and the migration file

### Reporting Bugs

Open an issue with:

- Steps to reproduce
- Expected vs actual behavior
- Browser/Node version
- Relevant logs or screenshots

### Suggesting Features

Open an issue describing:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
