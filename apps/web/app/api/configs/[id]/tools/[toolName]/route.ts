import { NextRequest, NextResponse } from "next/server";
import { addToolSchema } from "@web-mcp-hub/db";
import { getConfigById, deleteToolFromConfig, updateToolInConfig } from "@/lib/db";
import { checkAuth, getUserName } from "@/lib/auth-check";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const updateToolSchema = addToolSchema.omit({ name: true }).partial();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; toolName: string }> },
) {
  const limited = rateLimit(request, { max: 20 });
  if (limited) return limited;

  const authResult = await checkAuth(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: authResult.error, message: authResult.helpMessage },
      { status: 401 },
    );
  }

  const { id, toolName } = await params;

  const existing = await getConfigById(id);
  if (!existing) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  const tool = existing.tools.find((t) => t.name === toolName);
  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  const userName = await getUserName(authResult.userId);
  const isConfigOwner = userName === existing.contributor;
  const isToolContributor = userName === tool.contributor;

  if (!isConfigOwner && !isToolContributor) {
    return NextResponse.json(
      { error: "Forbidden: only the config owner or the tool's contributor can update this tool" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = updateToolSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await updateToolInConfig(id, toolName, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; toolName: string }> },
) {
  const limited = rateLimit(request, { max: 20 });
  if (limited) return limited;

  const authResult = await checkAuth(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: authResult.error, message: authResult.helpMessage },
      { status: 401 },
    );
  }

  const { id, toolName } = await params;

  const existing = await getConfigById(id);
  if (!existing) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  const tool = existing.tools.find((t) => t.name === toolName);
  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  const userName = await getUserName(authResult.userId);
  const isConfigOwner = userName === existing.contributor;
  const isToolContributor = userName === tool.contributor;

  if (!isConfigOwner && !isToolContributor) {
    return NextResponse.json(
      { error: "Forbidden: only the config owner or the tool's contributor can delete this tool" },
      { status: 403 },
    );
  }

  const config = await deleteToolFromConfig(id, toolName);
  if (!config) {
    return NextResponse.json({ message: "Tool deleted; config auto-removed (no tools remaining)" });
  }
  return NextResponse.json(config);
}
