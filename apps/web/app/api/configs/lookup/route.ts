import { NextRequest, NextResponse } from "next/server";
import { lookupByDomain } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const domain = params.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "domain query parameter is required" }, { status: 400 });
  }

  const url = params.get("url") ?? undefined;
  const executable = params.get("executable") === "true";
  const yolo = params.get("yolo") === "true";
  const configs = await lookupByDomain(domain, url, { executable, yolo });
  return NextResponse.json({ configs });
}
