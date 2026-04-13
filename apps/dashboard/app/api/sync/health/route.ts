// apps/dashboard/app/api/sync/health/route.ts
import { NextResponse } from "next/server";
import { getSystemHealth } from "@/lib/supabase-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getSystemHealth();

  if (!state) {
    return NextResponse.json(
      { error: "Unable to fetch system state from Supabase" },
      { status: 502 }
    );
  }

  return NextResponse.json(state);
}
