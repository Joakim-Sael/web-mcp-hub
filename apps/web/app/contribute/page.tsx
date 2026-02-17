import Link from "next/link";

export const metadata = {
  title: "Contribute — WebMCP Hub",
  description: "Learn how to contribute WebMCP configs via REST API or MCP server",
};

const restExample = `curl -X POST https://webmcp-hub.com/api/configs \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer whub_your_api_key" \\
  -d '{
    "domain": "example.com",
    "urlPattern": "example.com/tasks",
    "title": "Example Task Manager",
    "description": "Create, list, and delete tasks",
    "contributor": "your-github-username",
    "tags": ["productivity", "tasks"],
    "tools": [{
      "name": "add-task",
      "description": "Add a new task to the list",
      "inputSchema": {
        "type": "object",
        "properties": {
          "title": { "type": "string", "description": "Task title" }
        },
        "required": ["title"]
      }
    }]
  }'`;

const mcpRemoteConfig = `{
  "mcpServers": {
    "web-mcp-hub": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://webmcp-hub-mcp.flowagentlyhub.workers.dev/mcp"
      ]
    }
  }
}`;

const mcpLocalConfig = `{
  "mcpServers": {
    "web-mcp-hub": {
      "command": "node",
      "args": ["path/to/packages/mcp-server/dist/index.js", "--stdio"],
      "env": {
        "HUB_URL": "http://localhost:3000"
      }
    }
  }
}`;

const fullExample = `{
  "domain": "example.com",
  "urlPattern": "example.com/tasks",
  "title": "Task Manager",
  "description": "Create, list, and delete tasks",
  "contributor": "your-username",
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
        "fields": [{
          "type": "text",
          "selector": "#titleInput",
          "name": "title",
          "description": "Task title field"
        }]
      }
    },
    {
      "name": "list-tasks",
      "description": "List all current tasks",
      "inputSchema": { "type": "object", "properties": {} },
      "execution": {
        "selector": "#taskList",
        "autosubmit": false,
        "resultSelector": "#taskList li",
        "resultExtract": "list"
      }
    }
  ]
}`;

function Code({ children }: { children: string; label?: string }) {
  return (
    <pre className="bg-zinc-950 rounded-lg p-4 overflow-x-auto text-xs leading-relaxed text-zinc-300">
      <code>{children}</code>
    </pre>
  );
}

export default function ContributePage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <h1 className="text-2xl font-bold text-white">Contribute a Config</h1>
      <p className="text-zinc-400 mt-1 mb-8">
        Teach AI agents how to interact with any website by submitting a WebMCP configuration.
      </p>

      {/* Auth callout */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 mb-8">
        <h2 className="text-sm font-semibold text-white mb-2">Before you start</h2>
        <p className="text-sm text-zinc-400">
          Write operations require an API key.{" "}
          <Link href="/auth/signin" className="text-blue-400 hover:text-blue-300">
            Sign in with GitHub
          </Link>
          , then create a key in{" "}
          <Link href="/settings" className="text-blue-400 hover:text-blue-300">
            Settings
          </Link>
          . Keys start with{" "}
          <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">whub_</code>. All read
          endpoints are public — no key needed to browse or look up configs.
        </p>
      </div>

      {/* Two method cards */}
      <div className="grid lg:grid-cols-2 gap-6 mb-10">
        {/* REST API card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[0.65rem] font-medium px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 uppercase tracking-wider">
                REST API
              </span>
            </div>
            <h2 className="text-lg font-semibold text-white">Direct HTTP requests</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Use <code className="text-zinc-300">curl</code>, fetch, or any HTTP client to submit
              configs programmatically.
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Create a config
              </p>
              <Code>{restExample}</Code>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Endpoints
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-baseline gap-2">
                  <code className="text-emerald-400 text-xs w-11 shrink-0">GET</code>
                  <code className="text-zinc-300 text-xs">https://webmcp-hub.com/api/configs</code>
                  <span className="text-zinc-500 text-xs">List</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <code className="text-blue-400 text-xs w-11 shrink-0">POST</code>
                  <code className="text-zinc-300 text-xs">https://webmcp-hub.com/api/configs</code>
                  <span className="text-zinc-500 text-xs">Create</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <code className="text-emerald-400 text-xs w-11 shrink-0">GET</code>
                  <code className="text-zinc-300 text-xs">
                    https://webmcp-hub.com/api/configs/lookup
                  </code>
                  <span className="text-zinc-500 text-xs">Lookup by domain</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <code className="text-emerald-400 text-xs w-11 shrink-0">GET</code>
                  <code className="text-zinc-300 text-xs">
                    https://webmcp-hub.com/api/configs/:id
                  </code>
                  <span className="text-zinc-500 text-xs">Get by ID</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <code className="text-amber-400 text-xs w-11 shrink-0">PATCH</code>
                  <code className="text-zinc-300 text-xs">
                    https://webmcp-hub.com/api/configs/:id
                  </code>
                  <span className="text-zinc-500 text-xs">Update</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <code className="text-blue-400 text-xs w-11 shrink-0">POST</code>
                  <code className="text-zinc-300 text-xs">
                    https://webmcp-hub.com/api/configs/:id/vote
                  </code>
                  <span className="text-zinc-500 text-xs">Vote on tool</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MCP card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[0.65rem] font-medium px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 uppercase tracking-wider">
                MCP
              </span>
            </div>
            <h2 className="text-lg font-semibold text-white">Via any MCP client</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Connect the MCP server to your AI agent and use{" "}
              <code className="text-zinc-300">upload_config</code> and{" "}
              <code className="text-zinc-300">update_config</code> to submit configs
              conversationally.
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Remote (no local setup)
              </p>
              <Code>{mcpRemoteConfig}</Code>
            </div>
            <details>
              <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
                Local server (for development)
              </summary>
              <div className="mt-2">
                <Code>{mcpLocalConfig}</Code>
              </div>
            </details>
            <p className="text-sm text-zinc-400">
              Your AI agent will use <code className="text-zinc-300">upload_config</code>,{" "}
              <code className="text-zinc-300">update_config</code>, and{" "}
              <code className="text-zinc-300">vote_on_tool</code> automatically when you ask it to
              contribute, modify, or rate configs.
            </p>
          </div>
        </div>
      </div>

      {/* Config reference */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">Config reference</h2>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Fields */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
              Required fields
            </p>
            <dl className="space-y-2 text-sm">
              {[
                ["domain", "Normalized domain, e.g. github.com"],
                ["urlPattern", "URL scope for matching (see below)"],
                ["title", "Human-readable name"],
                ["description", "What agents can do with this config"],
                ["contributor", "Your name or GitHub username"],
                ["tools", "Array of tool descriptors (min 1)"],
              ].map(([field, desc]) => (
                <div key={field} className="flex gap-3">
                  <dt className="font-mono text-xs text-zinc-300 w-24 shrink-0">{field}</dt>
                  <dd className="text-zinc-400">{desc}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* URL patterns */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
              URL patterns
            </p>
            <dl className="space-y-2 text-sm">
              {[
                ["example.com", "All pages (fallback)"],
                ["example.com/dashboard", "Exact path only"],
                ["example.com/users/:id", "Dynamic segment"],
                ["example.com/admin/**", "Wildcard prefix"],
              ].map(([pattern, desc]) => (
                <div key={pattern} className="flex gap-3">
                  <dt className="font-mono text-xs text-zinc-300 shrink-0">{pattern}</dt>
                  <dd className="text-zinc-500">{desc}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Tool rules */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
            Tool rules
          </p>
          <ul className="text-sm text-zinc-400 space-y-1.5">
            <li>
              <code className="text-zinc-300">name</code> — kebab-case verb:{" "}
              <code className="text-zinc-500">search-products</code>,{" "}
              <code className="text-zinc-500">add-to-cart</code>,{" "}
              <code className="text-zinc-500">delete-item</code>
            </li>
            <li>
              <code className="text-zinc-300">inputSchema</code> — JSON Schema object. Each property
              needs at least <code className="text-zinc-500">{`{"type":"string"}`}</code>
            </li>
            <li>
              <code className="text-zinc-300">execution</code> — optional CSS selector metadata for
              Chrome extension auto-execution
            </li>
            <li>
              <code className="text-zinc-300">annotations</code> — optional:{" "}
              <code className="text-zinc-500">readOnlyHint</code>,{" "}
              <code className="text-zinc-500">destructiveHint</code>,{" "}
              <code className="text-zinc-500">idempotentHint</code>
            </li>
          </ul>
        </div>

        {/* Full example */}
        <details>
          <summary className="text-sm text-zinc-400 cursor-pointer hover:text-zinc-200 mb-2">
            Full example with execution metadata
          </summary>
          <Code>{fullExample}</Code>
        </details>
      </section>

      {/* Contribute to the project */}
      <section className="border-t border-zinc-800 pt-8">
        <h2 className="text-lg font-semibold text-white mb-2">
          Want to contribute to the project?
        </h2>
        <p className="text-sm text-zinc-400 mb-4">
          Beyond submitting configs, you can help improve the hub itself — fix bugs, add features,
          improve docs, or extend the Chrome extension and MCP server.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://github.com/Joakim-Sael/web-mcp-hub/blob/main/CONTRIBUTING.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors border border-zinc-700 font-medium"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Contributing guide
          </a>
          <Link
            href="/settings"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Get an API key
          </Link>
          <Link
            href="/#browse"
            className="px-4 py-2 bg-zinc-800 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors border border-zinc-700 font-medium"
          >
            Browse configs
          </Link>
        </div>
      </section>
    </div>
  );
}
