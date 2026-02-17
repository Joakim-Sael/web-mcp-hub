import { NextRequest, NextResponse } from "next/server";
import { getConfigById, upsertToolVote, getToolVotes } from "@/lib/db";
import { checkAuth } from "@/lib/auth-check";

export const dynamic = "force-dynamic";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, { max: 30 });
  if (limited) return limited;

  const authResult = await checkAuth(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: authResult.error, message: authResult.helpMessage },
      { status: 401 },
    );
  }

  const { id } = await params;

  const body = await request.json();
  const { toolName, vote } = body as { toolName?: string; vote?: number };

  if (!toolName || typeof toolName !== "string") {
    return NextResponse.json({ error: "toolName is required" }, { status: 400 });
  }
  if (vote !== 1 && vote !== -1) {
    return NextResponse.json({ error: "vote must be 1 or -1" }, { status: 400 });
  }

  const config = await getConfigById(id);
  if (!config) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  const toolExists = config.tools.some((t) => t.name === toolName);
  if (!toolExists) {
    return NextResponse.json(
      { error: `Tool "${toolName}" not found in this config` },
      { status: 404 },
    );
  }

  await upsertToolVote(authResult.userId, id, toolName, vote);
  const updated = await getToolVotes(id, toolName, authResult.userId);

  return NextResponse.json({
    configId: id,
    toolName,
    score: updated.score,
    userVote: updated.userVote,
  });
}
