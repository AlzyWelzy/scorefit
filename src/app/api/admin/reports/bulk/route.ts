import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isUserAdmin, resolveReportsForTarget, setSocialSuspension, logAdminAction } from "@/db/moderation";
import { hideActivityEvent } from "@/db/social";
import { captureException } from "@/lib/observability";
import { sameOrigin } from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({
  targetType: z.enum(["user", "display_name", "activity_event", "caption"]),
  targetId: z.string().min(1).max(120),
  outcome: z.enum(["actioned", "dismissed"]),
  suspendUserId: z.string().uuid().nullable().optional(),
});

// Resolve every open report against one target at once (admin-only).
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isUserAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { targetType, targetId, outcome, suspendUserId } = parsed.data;

  if (outcome === "actioned") {
    if (targetType === "activity_event") {
      try {
        await hideActivityEvent(targetId);
      } catch (err) {
        await captureException(err, { where: "admin.bulkHide", extra: { targetId } });
      }
    }
    if (suspendUserId) await setSocialSuspension(suspendUserId, true);
  }

  const resolved = await resolveReportsForTarget(targetType, targetId, session.user.id, outcome);
  await logAdminAction({
    adminId: session.user.id,
    action: `report.bulk.${outcome}`,
    targetType: "report",
    targetId,
    detail: { resolved, contentTargetType: targetType, suspended: outcome === "actioned" && !!suspendUserId },
  });

  return NextResponse.json({ ok: true, resolved }, { status: 200 });
}
