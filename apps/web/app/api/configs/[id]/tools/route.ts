import { NextRequest, NextResponse } from "next/server";
import { addToolSchema } from "@web-mcp-hub/db";
import { getConfigById, addToolToConfig } from "@/lib/db";
import { checkAuth, getUserName } from "@/lib/auth-check";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, { max: 20 });
  if (limited) return limited;

  const authResult = await checkAuth(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: authResult.error, message: authResult.helpMessage },
      { status: 401 },
    );
  }

  const { id } = await params;

  const config = await getConfigById(id);
  if (!config) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  const MAX_BODY_SIZE = 512 * 1024; // 512KB
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_SIZE) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  const body = await request.json();
  const parsed = addToolSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const contributor = await getUserName(authResult.userId);
  if (!contributor) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const tool = await addToolToConfig(id, parsed.data, contributor);
  if (tool === "limit") {
    return NextResponse.json({ error: "Config has reached the 50-tool limit" }, { status: 422 });
  }
  if (!tool) {
    return NextResponse.json(
      { error: `Tool name "${parsed.data.name}" is already taken in this config` },
      { status: 409 },
    );
  }

  return NextResponse.json(tool, { status: 201 });
}
