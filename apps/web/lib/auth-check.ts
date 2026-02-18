import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, apiKeys, users } from "@web-mcp-hub/db";
import { auth } from "./auth";

type AuthResult =
  | { authenticated: true; userId: string; source: "api-key" | "session" }
  | { authenticated: false; error: string; helpMessage: string };

export async function getUserName(userId: string): Promise<string | null> {
  const db = getDb();
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  return user?.name ?? null;
}

export async function checkAuth(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");

  // Reject deprecated GitHub token auth with a clear migration message
  if (authHeader?.startsWith("GitHub ")) {
    return {
      authenticated: false,
      error: "GitHub token auth is no longer supported",
      helpMessage:
        "GitHub token authentication has been removed. " +
        "Exchange your token for an API key via POST /api/auth/exchange-token, " +
        "then use the API key via the Authorization header: Bearer whub_...",
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
