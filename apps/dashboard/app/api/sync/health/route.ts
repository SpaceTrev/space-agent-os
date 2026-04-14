import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(url + "/rest/v1/system_state?id=eq.singleton&select=*", {
      headers: { apikey: key, Authorization: "Bearer " + key },
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data?.[0]?.health ?? { status: "no data" });
  } catch {
    return NextResponse.json({ error: "Supabase unreachable" }, { status: 502 });
  }
}
