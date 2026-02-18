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
  apiKey: string;
  name: string;
};

export class WebMcpHubMCP extends McpAgent<Env, object, Props> {
  server = new McpServer({
    name: "WebMCP Hub",
    version: "1.0.0",
  });

  // Mutable hubOpts — shared by reference with tool closures so that
  // updateProps() can swap the API key without re-registering tools.
  hubOpts: HubClientOptions = { hubUrl: "" };
  toolsRegistered = false;

  async init() {
    this.hubOpts.hubUrl = this.env.HUB_URL ?? "https://www.webmcp-hub.com";
    this.hubOpts.apiKey = this.props?.apiKey;
    if (!this.toolsRegistered) {
      registerTools(this as AgentLike, this.hubOpts);
      this.toolsRegistered = true;
    }
  }

  async updateProps(props: Props) {
    super.updateProps(props);
    this.hubOpts.apiKey = props.apiKey;
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
