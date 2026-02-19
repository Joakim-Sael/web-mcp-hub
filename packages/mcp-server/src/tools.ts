import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatConfig } from "@web-mcp-hub/db";
import * as hub from "./hub-client.js";

const executionSchema = z
  .object({
    selector: z
      .string()
      .describe("CSS selector for the primary container (form, button, content area)"),
    fields: z
      .array(
        z.object({
          type: z
            .enum(["text", "number", "textarea", "select", "checkbox", "radio", "date", "hidden"])
            .describe("Field type"),
          selector: z.string().describe("CSS selector for the input element"),
          name: z.string().describe("Parameter name matching inputSchema property"),
          description: z.string().describe("Description for the agent"),
          required: z.boolean().optional().describe("Whether field is required (default: true)"),
          defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
          options: z
            .array(
              z.object({ value: z.string(), label: z.string(), selector: z.string().optional() }),
            )
            .optional()
            .describe("For select/radio fields"),
          dynamicOptions: z.boolean().optional().describe("For select fields with dynamic options"),
        }),
      )
      .optional()
      .describe("Input field mappings to DOM elements"),
    autosubmit: z
      .boolean()
      .describe(
        "Whether to submit after filling fields. true=submit/click or enter, false=fill-only or extract",
      ),
    submitAction: z
      .enum(["click", "enter"])
      .optional()
      .describe(
        "How to submit: 'click' (default) clicks a button, 'enter' dispatches Enter key on the last filled field",
      ),
    submitSelector: z
      .string()
      .optional()
      .describe("CSS selector for custom submit button (only used with submitAction 'click')"),
    resultSelector: z.string().optional().describe("CSS selector for where to read the result"),
    resultExtract: z
      .enum(["text", "html", "attribute", "table", "list"])
      .optional()
      .describe("How to extract the result"),
    resultAttribute: z
      .string()
      .optional()
      .describe(
        "HTML attribute name to read when resultExtract is 'attribute', e.g. 'href', 'data-id'",
      ),
    steps: z
      .array(
        z
          .object({
            action: z
              .enum([
                "navigate",
                "click",
                "fill",
                "select",
                "wait",
                "extract",
                "scroll",
                "condition",
              ])
              .describe("The action type for this step"),
            selector: z.string().optional().describe("CSS selector (required for most actions)"),
            url: z.string().optional().describe("URL for navigate steps, supports {{paramName}}"),
            value: z
              .string()
              .optional()
              .describe("Value for fill/select steps, supports {{paramName}}"),
            state: z
              .enum(["visible", "exists", "hidden"])
              .optional()
              .describe("State to check for wait/condition steps"),
            timeout: z.number().optional().describe("Timeout in ms for wait steps"),
            extract: z
              .enum(["text", "html", "list", "table", "attribute"])
              .optional()
              .describe("Extraction mode for extract steps"),
            attribute: z
              .string()
              .optional()
              .describe("Attribute name for extract steps with extract:'attribute'"),
            then: z
              .array(z.record(z.string(), z.unknown()))
              .optional()
              .describe("Steps to run if condition matches"),
            else: z
              .array(z.record(z.string(), z.unknown()))
              .optional()
              .describe("Steps to run if condition does not match"),
          })
          .passthrough(),
      )
      .optional()
      .describe("Multi-step workflow (overrides simple mode). Array of action steps."),
    resultDelay: z.number().optional().describe("Milliseconds to wait before reading result"),
    resultWaitSelector: z
      .string()
      .optional()
      .describe("CSS selector to wait for before reading result"),
  })
  .optional()
  .describe(
    "Execution metadata for Chrome extension. Enables declarative tool execution via CSS selectors.",
  );

export function registerTools(server: McpServer): void {
  // lookup_config
  server.tool(
    "lookup_config",
    `Check if a WebMCP config exists for a domain/URL. Returns matching configs sorted by specificity (most specific first).

Configs are scoped to URL paths — pass the url parameter to get only configs relevant to a specific page. Without url, returns all configs for the domain.

URL pattern matching rules (patterns are always "domain/path" format — no protocol, no "www.", no Chrome extension match patterns):
- "example.com" (domain-only) — matches ALL pages on the domain (lowest priority, acts as fallback)
- "example.com/dashboard" — matches only /dashboard exactly
- "example.com/dashboard/:id" — matches /dashboard/<anything> (dynamic segment)
- "example.com/admin/**" — matches /admin and everything under it (wildcard)

When navigating between pages on the same domain, call lookup_config again with the new URL to get the correct page-specific tools.

By default, only verified configs are returned. If you are authenticated (via API key), your own unverified configs are also included automatically so you can test before verification. To see all unverified configs from everyone, set yolo=true.`,
    {
      domain: z.string().describe("Domain to look up, e.g. 'google.com'"),
      url: z
        .string()
        .optional()
        .describe(
          "Current page URL for path-scoped matching, e.g. 'example.com/dashboard/abc-123'. Returns only configs whose urlPattern matches this path, sorted most-specific-first.",
        ),
      executable: z
        .boolean()
        .optional()
        .describe("Filter to only configs with execution metadata (for Chrome extension)"),
      yolo: z
        .boolean()
        .optional()
        .describe(
          "Include unverified configs. Default false (only verified configs). Set true to see all configs including unverified ones.",
        ),
    },
    { readOnlyHint: true, openWorldHint: true },
    async ({ domain, url, executable, yolo }) => {
      try {
        const result = await hub.lookupConfig(domain, url, { executable, yolo });
        if (result.configs.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No configs found for domain "${domain}"${url ? ` with URL "${url}"` : ""}${executable ? " (executable only)" : ""}.`,
              },
            ],
          };
        }

        const text = result.configs.map((c) => formatConfig(c, true)).join("\n\n---\n\n");
        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${result.configs.length} config(s) for "${domain}":\n\n${text}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Hub unreachable: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // list_configs
  server.tool(
    "list_configs",
    "Browse and search all WebMCP configs in the hub. By default only verified configs are returned. If authenticated, your own unverified configs are also included. Set yolo=true to see all configs including unverified ones from everyone.",
    {
      search: z
        .string()
        .optional()
        .describe("Search term to filter by domain, title, or description"),
      tag: z.string().optional().describe("Filter by tag"),
      page: z.number().int().min(1).optional().describe("Page number (default 1)"),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Results per page (default 20, max 100)"),
      yolo: z
        .boolean()
        .optional()
        .describe(
          "Include unverified configs. Default false (only verified configs). Set true to see all configs including unverified ones.",
        ),
    },
    { readOnlyHint: true, openWorldHint: true },
    async ({ search, tag, page, pageSize, yolo }) => {
      try {
        const result = await hub.listConfigs({ search, tag, page, pageSize, yolo });

        if (result.configs.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No configs found matching your criteria.",
              },
            ],
          };
        }

        const summaries = result.configs
          .map((c) => {
            const execCount = c.tools.filter((t) => t.execution).length;
            const execLabel = execCount > 0 ? ` (${execCount} executable)` : "";
            return `- ${c.title} (${c.domain}) [${c.tools.length} tools${execLabel}] — ID: ${c.id}`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Showing ${result.configs.length} of ${result.total} configs (page ${result.page}):\n\n${summaries}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Hub unreachable: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // upload_config
  server.tool(
    "upload_config",
    `Submit a new WebMCP config for a website. Returns 409 if a config already exists for this domain+urlPattern.

## URL Pattern Scoping

Configs are scoped to specific URL paths via urlPattern. The Chrome extension and lookup_config use pattern matching to return only relevant configs for the current page.

**IMPORTANT: urlPattern must be in "domain/path" format — bare domain with optional path. No protocol, no scheme wildcards.**
  CORRECT: \`"youtube.com"\`, \`"youtube.com/**"\`, \`"example.com/dashboard/:id"\`
  WRONG:   \`"*://www.youtube.com/*"\` — this is a Chrome extension match pattern, NOT a valid urlPattern
  WRONG:   \`"https://example.com/page"\` — no protocol prefix allowed (it gets stripped, but avoid it)

**Pattern types (from most to least specific):**
- \`"example.com/admin/dashboard"\` — exact path match (only /admin/dashboard)
- \`"example.com/dashboard/:id"\` — dynamic segment, matches /dashboard/<any-single-segment> (e.g. UUIDs, usernames)
- \`"example.com/admin/**"\` — wildcard, matches /admin and everything under it. ** must be the last segment.
- \`"example.com"\` — domain-only fallback, matches ALL pages on the domain (lowest priority)

**Best practices:**
- Use domain-only (\`"example.com"\`) for tools that apply to every page (e.g. navigation, global search)
- Use exact paths for page-specific tools (e.g. \`"example.com/settings"\` for settings-page tools)
- Use \`:param\` for pages with dynamic IDs (e.g. \`"example.com/users/:userId/profile"\`) — avoids creating a config per user
- Use \`**\` for section-wide tools (e.g. \`"example.com/admin/**"\` for tools available across all admin pages)
- Create separate configs for different sections of a site rather than one catch-all

## Tool Schema Rules

Each tool in the tools array MUST follow this structure:

- **name**: kebab-case with a verb, e.g. "search-products", "add-to-cart", "delete-item", "list-tasks"
- **description**: What the tool does and when to use it
- **inputSchema**: MUST be a valid JSON Schema object. The API will REJECT invalid schemas with a 400 error.
  RULE: Every value inside "properties" MUST be an object with at least a "type" field. NEVER use a raw number, string, or boolean as a property value.
  CORRECT:   {"type":"object","properties":{"query":{"type":"string","description":"Search term"},"limit":{"type":"number","description":"Max results"}},"required":["query"]}
  WRONG:     {"type":"object","properties":{"query":127}} ← 127 is a number, not a schema object
  WRONG:     {"type":"object","properties":{"query":200,"limit":129}} ← raw numbers are NOT property schemas
  WRONG:     {"type":"object","properties":{"name":"string"}} ← "string" is a raw string, not a schema object
  WRONG:     {"properties":{"query":{"type":"string"}}} ← missing top-level "type":"object"
  Property values must ALWAYS look like: {"type":"string","description":"..."} or {"type":"number","description":"..."}
- **annotations**: Optional hints like readOnlyHint, destructiveHint, idempotentHint, openWorldHint

## Execution Metadata (optional, for Chrome extension)

Maps tool parameters to DOM elements via CSS selectors. Two modes:

**Simple mode** — fill fields and optionally submit:
  - selector: CSS selector for the form/container
  - fields[]: array of {type, selector, name, description} mapping params to inputs
  - autosubmit: true to submit after filling, false for fill-only or extract
  - submitAction: "click" (default) clicks a button, "enter" presses Enter key on the input field
  - submitSelector: optional custom submit button selector (for click mode)
  - resultSelector + resultExtract: where and how to read the result ("text"|"html"|"list"|"table"|"attribute")

**Multi-step mode** — steps[] array overrides simple mode:
  - Each step has an "action": navigate, click, fill, select, wait, extract, scroll, condition
  - Use {{paramName}} in url/value/selector for parameter interpolation

**Special selector support**:
  - :has-text("...") — matches elements containing text, e.g. 'li:has-text("{{target}}") .delete-btn'
    This is NOT standard CSS but is supported by our extension for text-based element matching.

## Example Config

{
  "domain": "example.com",
  "urlPattern": "example.com/tasks",
  "title": "Task Manager",
  "description": "Manage tasks on the example app",
  "contributor": "agent",
  "tools": [{
    "name": "add-task",
    "description": "Add a new task",
    "inputSchema": {
      "type": "object",
      "properties": {
        "title": {"type": "string", "description": "Task title"}
      },
      "required": ["title"]
    },
    "execution": {
      "selector": "#taskForm",
      "autosubmit": true,
      "fields": [{"type": "text", "selector": "#titleInput", "name": "title", "description": "Task title field"}]
    }
  }, {
    "name": "delete-task",
    "description": "Delete a task by its title",
    "inputSchema": {
      "type": "object",
      "properties": {
        "target": {"type": "string", "description": "Title of the task to delete"}
      },
      "required": ["target"]
    },
    "execution": {
      "selector": "li:has-text(\\"{{target}}\\") .delete-btn",
      "autosubmit": true
    }
  }, {
    "name": "list-tasks",
    "description": "List all current tasks",
    "inputSchema": {"type": "object", "properties": {}},
    "execution": {
      "selector": "#taskList",
      "autosubmit": false,
      "resultSelector": "#taskList li",
      "resultExtract": "list"
    }
  }]
}`,
    {
      domain: z
        .string()
        .describe(
          "Bare domain without protocol or www prefix, e.g. 'google.com', 'youtube.com'. NEVER include http://, https://, or www.",
        ),
      urlPattern: z
        .string()
        .describe(
          "URL pattern in 'domain/path' format. MUST be a bare domain with optional path — NEVER use Chrome extension match patterns like '*://...' or 'https://...'. Examples: 'example.com' (all pages), 'example.com/search' (exact), 'example.com/users/:id' (dynamic), 'example.com/admin/**' (prefix)",
        ),
      pageType: z
        .string()
        .optional()
        .describe("Type of page: search, form, dashboard, article, feed, qa, etc."),
      title: z.string().describe("Human-readable title, e.g. 'Google Search'"),
      description: z.string().describe("What this config enables agents to do on the page"),
      tools: z
        .array(
          z.object({
            name: z
              .string()
              .describe("Kebab-case tool name with a specific verb, e.g. 'search-products'"),
            description: z.string().describe("What the tool does and when to use it"),
            inputSchema: z
              .object({
                type: z.literal("object").describe("Must be 'object'"),
                properties: z
                  .record(
                    z.string(),
                    z
                      .object({ type: z.string() })
                      .passthrough()
                      .describe(
                        "Each property must be a schema object with at least a 'type' field",
                      ),
                  )
                  .default({})
                  .describe(
                    "Property definitions — each value must be a schema object like {type:'string',description:'...'}",
                  ),
                required: z
                  .array(z.string())
                  .optional()
                  .describe("List of required property names"),
              })
              .passthrough()
              .describe(
                "JSON Schema object. E.g. {type:'object', properties:{query:{type:'string',description:'Search query'}}, required:['query']}",
              ),
            annotations: z
              .record(z.string(), z.string())
              .optional()
              .describe(
                "Optional hints: readOnlyHint, destructiveHint, idempotentHint, openWorldHint",
              ),
            execution: executionSchema,
          }),
        )
        .describe("Array of WebMCP tool descriptors for this page"),
      contributor: z.string().describe("Who is contributing this config"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Optional tags for categorization, e.g. ['search', 'ecommerce']"),
    },
    { idempotentHint: false },
    async (args) => {
      try {
        const result = await hub.uploadConfig(args);

        if (result.status === 409) {
          return {
            content: [
              {
                type: "text" as const,
                text: `A config already exists for this domain+urlPattern. Existing config ID: ${result.existingId}. Use update_config to modify it.`,
              },
            ],
            isError: true,
          };
        }

        if (result.error) {
          return {
            content: [{ type: "text" as const, text: `Error: ${result.error}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Config created successfully!\n\n${formatConfig(result.config!)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Hub unreachable: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // vote_on_tool
  server.tool(
    "vote_on_tool",
    `Upvote or downvote a specific tool (action) within a WebMCP config. Each user gets one vote per tool — voting the same direction again removes the vote (toggle off).

Use this to signal quality: upvote tools that work well, downvote ones that are broken or poorly configured.`,
    {
      configId: z
        .string()
        .describe("The config ID containing the tool (from lookup_config or list_configs)"),
      toolName: z.string().describe("The tool name to vote on, e.g. 'search-products'"),
      vote: z
        .number()
        .int()
        .describe(
          "1 for upvote, -1 for downvote. Voting the same direction again removes the vote.",
        ),
    },
    { idempotentHint: true },
    async ({ configId, toolName, vote }) => {
      if (vote !== 1 && vote !== -1) {
        return {
          content: [{ type: "text" as const, text: "Error: vote must be 1 or -1" }],
          isError: true,
        };
      }
      try {
        const result = await hub.voteOnTool(configId, toolName, vote);

        if (result.error) {
          return {
            content: [{ type: "text" as const, text: `Error: ${result.error}` }],
            isError: true,
          };
        }

        const r = result.result!;
        const voteLabel =
          r.userVote === 1 ? "upvoted" : r.userVote === -1 ? "downvoted" : "removed vote";
        return {
          content: [
            {
              type: "text" as const,
              text: `Vote recorded: ${voteLabel} tool "${r.toolName}" in config ${r.configId}. Current score: ${r.score}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Hub unreachable: ${error}` }],
          isError: true,
        };
      }
    },
  );

  // update_config
  server.tool(
    "update_config",
    `Update an existing WebMCP config by ID. Auto-increments the version number. When updating tools, provide the COMPLETE tools array (it replaces, not merges).

CRITICAL: Every tool's inputSchema must be valid JSON Schema. Each property must be a schema object like {"type":"string","description":"..."}, never a raw value like 200 or "string".

CRITICAL: urlPattern must be in "domain/path" format (e.g. "youtube.com/**"). NEVER use Chrome extension match patterns like "*://www.youtube.com/*" — these will break URL matching in the extension.

See upload_config for full schema rules, execution metadata docs, and examples.`,
    {
      id: z.string().describe("The config ID to update (from lookup_config or list_configs)"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      pageType: z.string().optional().describe("New page type"),
      tools: z
        .array(
          z.object({
            name: z.string().describe("Kebab-case tool name with a specific verb"),
            description: z.string().describe("What the tool does and when to use it"),
            inputSchema: z
              .object({
                type: z.literal("object").describe("Must be 'object'"),
                properties: z
                  .record(z.string(), z.object({ type: z.string() }).passthrough())
                  .default({})
                  .describe(
                    "Property definitions — each value must be a schema object with a 'type' field",
                  ),
                required: z.array(z.string()).optional(),
              })
              .passthrough()
              .describe("JSON Schema object with type, properties, and required"),
            annotations: z
              .record(z.string(), z.string())
              .optional()
              .describe("Optional hints: readOnlyHint, destructiveHint, etc."),
            execution: executionSchema,
          }),
        )
        .optional()
        .describe("Complete replacement tools array — provide all tools, not just changed ones"),
      contributor: z.string().optional().describe("Contributor name"),
      tags: z.array(z.string()).optional().describe("Updated tags"),
    },
    { idempotentHint: true },
    async ({ id, ...updates }) => {
      try {
        const result = await hub.updateConfig(id, updates);

        if (result.error) {
          return {
            content: [{ type: "text" as const, text: `Error: ${result.error}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Config updated successfully (now version ${result.config!.version})!\n\n${formatConfig(result.config!)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Hub unreachable: ${error}` }],
          isError: true,
        };
      }
    },
  );
}
