#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { localhostHostValidation } from "@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js";
import express from "express";
import { registerTools } from "./tools.js";

const server = new McpServer({
  name: "web-mcp-hub",
  version: "1.0.0",
});

registerTools(server);

if (process.argv.includes("--stdio")) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server running on stdio");
} else {
  const app = express();
  const PORT = process.env.MCP_PORT ?? 5001;

  app.use(express.json());
  app.use(localhostHostValidation());

  // Store transports by session ID for stateful connections
  const transports = new Map<string, StreamableHTTPServerTransport>();

  function cleanupSession(sessionId: string | undefined) {
    if (sessionId) transports.delete(sessionId);
  }

  app.post("/mcp", async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res, req.body);
        return;
      }

      // New session — create transport
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
      });

      transport.onclose = () => cleanupSession(transport.sessionId);
      res.on("error", () => cleanupSession(transport.sessionId));

      await server.connect(transport);

      if (transport.sessionId) {
        transports.set(transport.sessionId, transport);
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("POST /mcp error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  app.get("/mcp", async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      }
      res.status(400).json({ error: "No valid session. Send a POST first." });
    } catch (error) {
      console.error("GET /mcp error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  app.delete("/mcp", async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      }
      res.status(400).json({ error: "No valid session." });
    } catch (error) {
      console.error("DELETE /mcp error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  app.listen(PORT, () => {
    console.log(`MCP server running at http://localhost:${PORT}/mcp`);
  });
}
