import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const url = new URL(request.url);
  const rawLimit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Math.max(1, Math.min(50, Number.isNaN(rawLimit) ? 50 : rawLimit));

  const leaderboard = await getLeaderboard(limit);
  return NextResponse.json(leaderboard);
}
