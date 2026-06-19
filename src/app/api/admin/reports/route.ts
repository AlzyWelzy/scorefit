import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isUserAdmin, resolveReport, setSocialSuspension } from "@/db/moderation";
import { sameOrigin } from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({
  reportId: z.string().uuid(),
  // "actioned" optionally suspends the reported user's social privileges; "dismissed"
  // just closes the report. Suspension targets the reported user id carried on the report.
  outcome: z.enum(["actioned", "dismissed"]),
  suspendUserId: z.string().uuid().nullable().optional(),
});

// Admin-only: resolve a report and optionally suspend the reported user's social
// privileges. Gated on the live isAdmin flag (read fresh — never trusted from the JWT).
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isUserAdmin(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  await resolveReport(parsed.data.reportId, session.user.id, parsed.data.outcome);
  if (parsed.data.outcome === "actioned" && parsed.data.suspendUserId) {
    await setSocialSuspension(parsed.data.suspendUserId, true);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
