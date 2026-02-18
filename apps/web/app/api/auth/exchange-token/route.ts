import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { getDb, apiKeys, users, accounts } from "@web-mcp-hub/db";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { max: 10 });
  if (limited) return limited;

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("GitHub ")) {
    return NextResponse.json(
      {
        error: "Missing GitHub token",
        message:
          'Send your GitHub Personal Access Token via the Authorization header: "Authorization: GitHub ghp_..."',
      },
      { status: 401 },
    );
  }

  const token = authHeader.slice(7); // "GitHub ".length

  // Validate token with GitHub API
  const ghRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "WebMCP-Hub",
    },
  });

  if (!ghRes.ok) {
    return NextResponse.json(
      {
        error: "Invalid GitHub token",
        message: "The provided GitHub token is invalid or expired.",
      },
      { status: 401 },
    );
  }

  const ghUser = (await ghRes.json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string;
    email: string | null;
  };
  const githubId = String(ghUser.id);

  const db = getDb();

  // Look up existing account
  const [existingAccount] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.provider, "github"), eq(accounts.providerAccountId, githubId)));

  let userId: string;

  if (existingAccount) {
    userId = existingAccount.userId;
  } else {
    // Auto-create user + account (same logic as the old validateGitHubToken)
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
    });

    userId = newUser.id;
  }

  // Delete previous MCP worker keys for this user to prevent accumulation
  const mcpLabel = `MCP worker (${ghUser.login})`;
  await db.delete(apiKeys).where(and(eq(apiKeys.userId, userId), eq(apiKeys.label, mcpLabel)));

  // Generate a whub_ API key
  const rawBytes = randomBytes(30);
  const randomPart = rawBytes.toString("base64url").slice(0, 40);
  const plaintext = `whub_${randomPart}`;
  const prefix = plaintext.slice(0, 17); // "whub_" + 12 chars
  const hash = await bcrypt.hash(plaintext, 10);

  await db.insert(apiKeys).values({
    userId,
    keyHash: hash,
    keyPrefix: prefix,
    label: `MCP worker (${ghUser.login})`,
  });

  return NextResponse.json({
    apiKey: plaintext,
    login: ghUser.login,
    message:
      "Store this API key securely — it will not be shown again. " +
      "Use it via the Authorization header: Bearer whub_...",
  });
}
