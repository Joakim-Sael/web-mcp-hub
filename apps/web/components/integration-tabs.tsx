"use client";

import { useState } from "react";

const tabs = [
  {
    id: "api-lookup",
    label: "Look up",
    description: "Look up configs for any domain:",
    command: "GET https://webmcp-hub.com/api/configs/lookup?domain=google.com",
    multiline: false,
  },
  {
    id: "api-contribute",
    label: "Contribute",
    description: "Submit a config via REST API:",
    command: `curl -X POST https://webmcp-hub.com/api/configs \\
  -H "Authorization: Bearer whub_..." \\
  -d '{"domain":"google.com", ...}'`,
    multiline: true,
  },
  {
    id: "mcp",
    label: "MCP Server",
    description: "Add to your MCP client config:",
    command: `{
  "mcpServers": {
    "webmcp-hub": {
      "command": "npx",
      "args": ["mcp-remote",
        "https://webmcp-hub-mcp.flowagentlyhub.workers.dev/mcp"]
    }
  }
}`,
    multiline: true,
  },
];

export function IntegrationTabs() {
  const [active, setActive] = useState("api-lookup");
  const tab = tabs.find((t) => t.id === active)!;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <p className="text-zinc-300 text-sm mb-1">Search configs. Versioned. Community-driven.</p>
      <p className="text-zinc-500 text-sm mb-4">{tab.description}</p>

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              active === t.id
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-zinc-950 rounded-lg p-4 font-mono text-sm text-zinc-300 overflow-hidden">
        {tab.multiline ? (
          <pre className="whitespace-pre text-xs leading-relaxed">{tab.command}</pre>
        ) : (
          <code>{tab.command}</code>
        )}
      </div>

      <span className="inline-flex items-center gap-2 mt-4 text-sm text-zinc-500">
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z" />
        </svg>
        Download Chrome Extension
        <span className="text-[0.65rem] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">
          pending approval
        </span>
      </span>
    </div>
  );
}
