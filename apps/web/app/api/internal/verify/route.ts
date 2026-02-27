import { NextRequest, NextResponse } from "next/server";
import { setToolVerified } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { max: 30 });
  if (limited) return limited;

  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const headerSecret = request.headers.get("x-webhook-secret");
  if (headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { configId, toolName, verified } = body;

  if (
    typeof configId !== "string" ||
    typeof toolName !== "string" ||
    typeof verified !== "boolean"
  ) {
    return NextResponse.json(
      { error: "Invalid body: requires configId, toolName, verified" },
      { status: 400 },
    );
  }

  const found = await setToolVerified(configId, toolName, verified);
  if (!found) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
