import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { githubHandler } from "./github-handler";
import { registerTools, type AgentLike } from "./tools";
import type { HubClientOptions } from "./hub-client";

interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  COOKIE_ENCRYPTION_KEY: string;
  HUB_URL: string;
  OAUTH_KV: KVNamespace;
  MCP_OBJECT: DurableObjectNamespace;
}

type Props = Record<string, unknown> & {
  login: string;
  githubToken: string;
  name: string;
};

export class WebMcpHubMCP extends McpAgent<Env, {}, Props> {
  server = new McpServer({
    name: "WebMCP Hub",
    version: "1.0.0",
  });

  async init() {
    const hubOpts: HubClientOptions = {
      hubUrl: this.env.HUB_URL ?? "https://webmcp-hub.com",
      githubToken: this.props!.githubToken,
    };
    registerTools(this as AgentLike, hubOpts);
  }
}

export default new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: WebMcpHubMCP.mount("/mcp") as never,
  defaultHandler: githubHandler as never,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
