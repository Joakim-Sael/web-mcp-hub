import { Hono } from "hono";
import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}

interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  COOKIE_ENCRYPTION_KEY: string;
  HUB_URL: string;
  OAUTH_KV: KVNamespace;
  MCP_OBJECT: DurableObjectNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
}

const app = new Hono<{ Bindings: Env }>();

// Step 1: Redirect user to GitHub for authorization
app.get("/authorize", async (c) => {
  const oauthHelpers = c.env.OAUTH_PROVIDER;
  const authRequest = await oauthHelpers.parseAuthRequest(c.req.raw);

  // Store the auth request so we can complete it after GitHub callback
  const state = crypto.randomUUID();
  await c.env.OAUTH_KV.put(`github_auth:${state}`, JSON.stringify(authRequest), {
    expirationTtl: 600, // 10 minutes
  });

  const params = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID,
    redirect_uri: new URL("/callback", c.req.url).toString(),
    scope: "read:user user:email",
    state,
  });

  return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// Step 2: GitHub redirects back with code
app.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code || !state) {
    return c.text("Missing code or state", 400);
  }

  // Retrieve the original auth request
  const stored = await c.env.OAUTH_KV.get(`github_auth:${state}`);
  if (!stored) {
    return c.text("Invalid or expired state", 400);
  }
  await c.env.OAUTH_KV.delete(`github_auth:${state}`);
  const authRequest = JSON.parse(stored) as AuthRequest;

  // Exchange code for GitHub access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    return c.text(`GitHub OAuth error: ${tokenData.error ?? "unknown"}`, 400);
  }

  // Fetch GitHub user info
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "WebMCP-Hub-Worker",
    },
  });

  if (!userRes.ok) {
    return c.text("Failed to fetch GitHub user", 500);
  }

  const ghUser = (await userRes.json()) as GitHubUser;

  // Exchange GitHub token for a hub API key (one-time)
  const exchangeRes = await fetch(new URL("/api/auth/exchange-token", c.env.HUB_URL).toString(), {
    method: "POST",
    headers: {
      Authorization: `GitHub ${tokenData.access_token}`,
    },
  });

  if (!exchangeRes.ok) {
    return c.text("Failed to exchange GitHub token for API key", 500);
  }

  const exchangeData = (await exchangeRes.json()) as { apiKey: string; login: string };

  // Complete the OAuth authorization via OAuthHelpers method
  const oauthHelpers = c.env.OAUTH_PROVIDER;
  const { redirectTo } = await oauthHelpers.completeAuthorization({
    request: authRequest,
    userId: String(ghUser.id),
    metadata: { login: ghUser.login, name: ghUser.name ?? ghUser.login },
    scope: authRequest.scope,
    props: {
      login: ghUser.login,
      name: ghUser.name ?? ghUser.login,
      apiKey: exchangeData.apiKey,
    },
  });

  return c.redirect(redirectTo);
});

export { app as githubHandler };
export type { Env };
