import { NextRequest, NextResponse } from "next/server";
import { lookupByDomain } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { checkAuth, getUserName } from "@/lib/auth-check";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const domain = params.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "domain query parameter is required" }, { status: 400 });
  }

  // Best-effort auth: if the caller is authenticated, include their own
  // unverified configs in the results so they can test before verification.
  let currentUser: string | undefined;
  const authResult = await checkAuth(request);
  if (authResult.authenticated) {
    currentUser = (await getUserName(authResult.userId)) ?? undefined;
  }

  const url = params.get("url") ?? undefined;
  const executable = params.get("executable") === "true";
  const yolo = params.get("yolo") === "true";
  const configs = await lookupByDomain(domain, url, { executable, yolo, currentUser });
  return NextResponse.json({ configs });
}
