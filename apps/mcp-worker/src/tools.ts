import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatConfig } from "@web-mcp-hub/db";
import * as hub from "./hub-client";
import type { HubClientOptions } from "./hub-client";

export interface AgentLike {
  server: McpServer;
  props: { login: string; apiKey: string; name: string; [key: string]: unknown };
}

const executionSchema = z
  .object({
    selector: z.string().describe("CSS selector for the primary container"),
    fields: z
      .array(
        z.object({
          type: z.enum([
            "text",
            "number",
            "textarea",
            "select",
            "checkbox",
            "radio",
            "date",
            "file",
            "hidden",
          ]),
          selector: z.string(),
          name: z.string(),
          description: z.string(),
          required: z.boolean().optional(),
          defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
          options: z
            .array(
              z.object({ value: z.string(), label: z.string(), selector: z.string().optional() }),
            )
            .optional(),
          dynamicOptions: z.boolean().optional(),
        }),
      )
      .optional(),
    autosubmit: z.boolean(),
    submitAction: z.enum(["click", "enter"]).optional(),
    submitSelector: z.string().optional(),
    resultSelector: z.string().optional(),
    resultExtract: z.enum(["text", "html", "attribute", "table", "list"]).optional(),
    steps: z.array(z.record(z.string(), z.unknown())).optional(),
    resultDelay: z.number().optional(),
    resultWaitSelector: z.string().optional(),
  })
  .optional();

export function registerTools(agent: AgentLike, hubOpts: HubClientOptions): void {
  // lookup_config (read)
  agent.server.tool(
    "lookup_config",
    `Check if a WebMCP config exists for a domain/URL. Returns matching configs sorted by specificity.

URL patterns are always in "domain/path" format — no protocol, no "www.", no Chrome extension match patterns.
- "example.com" (domain-only) — matches ALL pages (lowest priority fallback)
- "example.com/dashboard" — exact path match
- "example.com/dashboard/:id" — dynamic segment
- "example.com/admin/**" — wildcard prefix match`,
    {
      domain: z.string().describe("Domain to look up, e.g. 'google.com'"),
      url: z.string().optional().describe("Current page URL for path-scoped matching"),
      executable: z.boolean().optional().describe("Filter to only executable configs"),
      yolo: z
        .boolean()
        .optional()
        .describe(
          "Include unverified configs. Default false (only verified configs). Set true to see all configs including unverified ones.",
        ),
    },
    async ({ domain, url, executable, yolo }) => {
      try {
        const result = await hub.lookupConfig(domain, url, { executable, yolo }, hubOpts);
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

  // list_configs (read)
  agent.server.tool(
    "list_configs",
    "Browse and search all WebMCP configs in the hub.",
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
        .describe("Results per page (default 20)"),
      yolo: z
        .boolean()
        .optional()
        .describe(
          "Include unverified configs. Default false (only verified configs). Set true to see all configs including unverified ones.",
        ),
    },
    async ({ search, tag, page, pageSize, yolo }) => {
      try {
        const result = await hub.listConfigs({ search, tag, page, pageSize, yolo }, hubOpts);
        if (result.configs.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No configs found matching your criteria." }],
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

  // upload_config (write — contributor forced to authenticated user)
  agent.server.tool(
    "upload_config",
    `Submit a new WebMCP config. Your GitHub username will be set as the contributor automatically. Returns 409 if a config already exists for this domain+urlPattern.

IMPORTANT: urlPattern must be in "domain/path" format — bare domain with optional path. No protocol, no scheme wildcards.
  CORRECT: "youtube.com", "youtube.com/**", "example.com/dashboard/:id"
  WRONG:   "*://www.youtube.com/*" — this is a Chrome extension match pattern, NOT a valid urlPattern
  WRONG:   "https://example.com/page" — no protocol prefix allowed`,
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
      pageType: z.string().optional().describe("Type of page: search, form, dashboard, etc."),
      title: z.string().describe("Human-readable title"),
      description: z.string().describe("What this config enables agents to do"),
      tools: z
        .array(
          z.object({
            name: z.string().describe("Kebab-case tool name with verb"),
            description: z.string().describe("What the tool does"),
            inputSchema: z.record(z.string(), z.unknown()).describe("JSON Schema object"),
            annotations: z.record(z.string(), z.string()).optional(),
            execution: executionSchema,
          }),
        )
        .describe("Array of WebMCP tool descriptors"),
      tags: z.array(z.string()).optional().describe("Optional tags for categorization"),
    },
    async (args) => {
      try {
        // Force contributor to the authenticated user's login
        const data = { ...args, contributor: agent.props.login };
        const result = await hub.uploadConfig(data, hubOpts);

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

  // vote_on_tool (write — requires authentication)
  agent.server.tool(
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
    async ({ configId, toolName, vote }) => {
      if (vote !== 1 && vote !== -1) {
        return {
          content: [{ type: "text" as const, text: "Error: vote must be 1 or -1" }],
          isError: true,
        };
      }
      try {
        const result = await hub.voteOnTool(configId, toolName, vote, hubOpts);

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

  // update_config (write — contributor forced to authenticated user)
  agent.server.tool(
    "update_config",
    `Update an existing WebMCP config by ID. Your GitHub username will be set as the contributor automatically. Auto-increments version.

CRITICAL: urlPattern must be in "domain/path" format (e.g. "youtube.com/**"). NEVER use Chrome extension match patterns like "*://www.youtube.com/*" — these will break URL matching in the extension.`,
    {
      id: z.string().describe("The config ID to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      pageType: z.string().optional().describe("New page type"),
      tools: z
        .array(
          z.object({
            name: z.string().describe("Kebab-case tool name"),
            description: z.string().describe("What the tool does"),
            inputSchema: z.record(z.string(), z.unknown()).describe("JSON Schema object"),
            annotations: z.record(z.string(), z.string()).optional(),
            execution: executionSchema,
          }),
        )
        .optional()
        .describe("Tools to add or update (merged by name with existing tools)"),
      tags: z.array(z.string()).optional().describe("Updated tags"),
    },
    async ({ id, ...updates }) => {
      try {
        // Force contributor to the authenticated user's login
        const data = { ...updates, contributor: agent.props.login };
        const result = await hub.updateConfig(id, data, hubOpts);

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
