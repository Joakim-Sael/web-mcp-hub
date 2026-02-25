import { NextRequest, NextResponse } from "next/server";
import { checkAuth, getUserName } from "@/lib/auth-check";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: authResult.error, message: authResult.helpMessage },
      { status: 401 },
    );
  }

  const username = await getUserName(authResult.userId);
  return NextResponse.json({ username });
}
