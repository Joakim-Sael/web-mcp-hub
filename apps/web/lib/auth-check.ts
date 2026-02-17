import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { getDb, apiKeys, users, accounts } from "@web-mcp-hub/db";
import { auth } from "./auth";

type AuthResult =
  | { authenticated: true; userId: string; source: "api-key" | "session" }
  | { authenticated: true; userId: string; source: "github-token"; githubLogin: string }
  | { authenticated: false; error: string; helpMessage: string };

// In-memory cache for GitHub token validation (5 min TTL)
const githubTokenCache = new Map<string, { userId: string; login: string; expiresAt: number }>();
const GITHUB_TOKEN_TTL = 5 * 60 * 1000; // 5 minutes

async function validateGitHubToken(token: string): Promise<{ userId: string; login: string } | null> {
  // Check cache first
  const cached = githubTokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return { userId: cached.userId, login: cached.login };
  }
  githubTokenCache.delete(token);

  // Validate token with GitHub API
  const ghRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "WebMCP-Hub",
    },
  });

  if (!ghRes.ok) return null;

  const ghUser = (await ghRes.json()) as { id: number; login: string; name: string | null; avatar_url: string; email: string | null };
  const githubId = String(ghUser.id);

  const db = getDb();

  // Look up existing account
  const [existingAccount] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.provider, "github"), eq(accounts.providerAccountId, githubId)));

  if (existingAccount) {
    githubTokenCache.set(token, { userId: existingAccount.userId, login: ghUser.login, expiresAt: Date.now() + GITHUB_TOKEN_TTL });
    return { userId: existingAccount.userId, login: ghUser.login };
  }

  // Auto-create user + account for MCP users who haven't signed in via web
  // Use null email to avoid unique constraint conflicts with existing web-auth users
  const [newUser] = await db
    .insert(users)
    .values({
      name: ghUser.name ?? ghUser.login,
      email: null,
      image: ghUser.avatar_url,
    })
    .returning();

  await db.insert(accounts).values({
    userId: newUser.id,
    type: "oauth",
    provider: "github",
    providerAccountId: githubId,
    access_token: token,
  });

  githubTokenCache.set(token, { userId: newUser.id, login: ghUser.login, expiresAt: Date.now() + GITHUB_TOKEN_TTL });
  return { userId: newUser.id, login: ghUser.login };
}

export async function checkAuth(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");

  // GitHub token auth: "Authorization: GitHub <token>"
  if (authHeader?.startsWith("GitHub ")) {
    const token = authHeader.slice(7); // "GitHub ".length
    const result = await validateGitHubToken(token);
    if (result) {
      return { authenticated: true, userId: result.userId, source: "github-token", githubLogin: result.login };
    }
    return {
      authenticated: false,
      error: "Invalid GitHub token",
      helpMessage: "The provided GitHub token is invalid or expired.",
    };
  }

  if (authHeader?.startsWith("Bearer whub_")) {
    const token = authHeader.slice(7); // "Bearer ".length
    const prefix = token.slice(0, 17); // "whub_" + 12 chars

    const db = getDb();
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyPrefix, prefix));

    if (key) {
      const valid = await bcrypt.compare(token, key.keyHash);
      if (valid) {
        // Fire-and-forget update of lastUsedAt
        db.update(apiKeys)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKeys.id, key.id))
          .then(() => {})
          .catch((err) => console.error("Failed to update API key lastUsedAt:", err));

        return { authenticated: true, userId: key.userId, source: "api-key" };
      }
    }

    return {
      authenticated: false,
      error: "Invalid API key",
      helpMessage: "The provided API key is invalid or has been deleted.",
    };
  }

  const session = await auth();
  if (session?.user?.id) {
    return { authenticated: true, userId: session.user.id, source: "session" };
  }

  const oauthConfigured = !!(
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET &&
    process.env.AUTH_SECRET
  );
  if (!oauthConfigured) {
    return {
      authenticated: false,
      error: "Authentication required",
      helpMessage:
        "This endpoint requires authentication. GitHub OAuth is not configured on this instance. " +
        "Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and AUTH_SECRET environment variables, or use an API key " +
        "via the Authorization header: Bearer whub_...",
    };
  }

  return {
    authenticated: false,
    error: "Authentication required",
    helpMessage:
      "This endpoint requires authentication. Sign in at /auth/signin to use the web UI, " +
      "or pass an API key via the Authorization header: Bearer whub_...",
  };
}
