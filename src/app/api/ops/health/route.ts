import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public, unauthenticated liveness probe for external uptime monitors. Runs a trivial DB
// query so it reflects real reachability, not just "the process is up". 200 = healthy,
// 503 = DB unreachable. No data, no secrets — safe to expose.
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
