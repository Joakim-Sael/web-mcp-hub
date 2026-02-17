import { NextRequest, NextResponse } from "next/server";
import { updateConfigSchema } from "@web-mcp-hub/db";
import { getConfigById, updateConfig } from "@/lib/db";

export const dynamic = "force-dynamic";
import { checkAuth } from "@/lib/auth-check";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(_request);
  if (limited) return limited;

  const { id } = await params;
  const config = await getConfigById(id);
  if (!config) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }
  return NextResponse.json(config);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const body = await request.json();
  const parsed = updateConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Enforce contributor to authenticated GitHub login
  if (authResult.source === "github-token") {
    parsed.data.contributor = authResult.githubLogin;
  }

  const config = await updateConfig(id, parsed.data);
  if (!config) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }
  return NextResponse.json(config);
}
