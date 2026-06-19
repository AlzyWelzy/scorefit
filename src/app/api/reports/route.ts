import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { createReport } from "@/db/moderation";
import { sameOrigin, rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({
  targetType: z.enum(["user", "display_name", "activity_event", "caption"]),
  targetId: z.string().min(1).max(120),
  reportedUserId: z.string().uuid().nullable().optional(),
  reason: z.enum(["spam", "harassment", "inappropriate", "impersonation", "other"]),
  detail: z.string().trim().max(500).optional(),
});

// File a moderation report. Available to any signed-in user; rate-limited so the
// queue can't be flooded. (Note: the social surfaces this protects are still behind
// feature flags — this is the plumbing that must exist before they ship.)
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = await clientIp();
  const rl = await rateLimit("report", `${ip}:${session.user.id}`, 10, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Too many reports. Try again later." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid report" }, { status: 400 });
  }

  // Can't report yourself.
  if (parsed.data.reportedUserId && parsed.data.reportedUserId === session.user.id) {
    return NextResponse.json({ error: "You can't report yourself." }, { status: 400 });
  }

  await createReport({
    reporterId: session.user.id,
    reportedUserId: parsed.data.reportedUserId ?? null,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    reason: parsed.data.reason,
    detail: parsed.data.detail,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
