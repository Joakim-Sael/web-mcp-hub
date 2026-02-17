import { NextRequest, NextResponse } from "next/server";
import { getStats } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const stats = await getStats();
  return NextResponse.json(stats);
}
