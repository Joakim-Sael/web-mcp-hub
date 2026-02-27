import { NextRequest, NextResponse } from "next/server";
import { createConfigSchema } from "@web-mcp-hub/db";
import {
  listConfigs,
  findByDomainAndPattern,
  createConfig,
  countConfigsByContributor,
} from "@/lib/db";

export const dynamic = "force-dynamic";
import { checkAuth, getUserName } from "@/lib/auth-check";
import { rateLimit } from "@/lib/rate-limit";
import { fireWebhook } from "@/lib/webhook";

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

  const yolo = params.get("yolo") === "true";

  let currentUser: string | undefined;
  const authResult = await checkAuth(request);
  if (authResult.authenticated) {
    currentUser = (await getUserName(authResult.userId)) ?? undefined;
  }

  const result = await listConfigs({ search, tag, page, pageSize, yolo, currentUser });
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

  const MAX_BODY_SIZE = 512 * 1024; // 512KB
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_SIZE) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  const body = await request.json();
  const parsed = createConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Set contributor to the authenticated user's name (GitHub login)
  const userName = await getUserName(authResult.userId);
  if (!userName) {
    return NextResponse.json({ error: "Could not resolve user" }, { status: 500 });
  }
  parsed.data.contributor = userName;

  const configCount = await countConfigsByContributor(userName);
  if (configCount >= 50) {
    return NextResponse.json(
      { error: "Config limit reached: maximum 50 configs per user" },
      { status: 403 },
    );
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

  for (const tool of config.tools) {
    fireWebhook("tool.created", {
      configId: config.id,
      toolName: tool.name,
      tool,
      contributor: tool.contributor ?? userName,
    });
  }

  return NextResponse.json(config, { status: 201 });
}
