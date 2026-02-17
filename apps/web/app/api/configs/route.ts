import { NextRequest, NextResponse } from "next/server";
import { createConfigSchema } from "@web-mcp-hub/db";
import { listConfigs, findByDomainAndPattern, createConfig } from "@/lib/db";

export const dynamic = "force-dynamic";
import { checkAuth } from "@/lib/auth-check";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const search = params.get("search") ?? undefined;
  const tag = params.get("tag") ?? undefined;
  const page = Math.max(1, params.get("page") ? parseInt(params.get("page")!, 10) : 1);
  const pageSize = Math.min(
    100,
    Math.max(1, params.get("pageSize") ? parseInt(params.get("pageSize")!, 10) : 20),
  );

  const result = await listConfigs({ search, tag, page, pageSize });
  return NextResponse.json({ ...result, page, pageSize });
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { max: 20 });
  if (limited) return limited;

  const authResult = await checkAuth(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: authResult.error, message: authResult.helpMessage },
      { status: 401 },
    );
  }

  const body = await request.json();
  const parsed = createConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Enforce contributor to authenticated GitHub login
  if (authResult.source === "github-token") {
    parsed.data.contributor = authResult.githubLogin;
  }

  const existing = await findByDomainAndPattern(parsed.data.domain, parsed.data.urlPattern);
  if (existing) {
    return NextResponse.json(
      {
        error: "A config for this domain + urlPattern already exists",
        existingId: existing.id,
      },
      { status: 409 },
    );
  }

  const config = await createConfig(parsed.data);
  return NextResponse.json(config, { status: 201 });
}
