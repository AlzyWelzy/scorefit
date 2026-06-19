import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { recordBodyWeight, deleteBodyWeight } from "@/db/bodyMetrics";
import { resolveLocalDate } from "@/lib/time";
import { sameOrigin } from "@/lib/rateLimit";

export const runtime = "nodejs";

const postSchema = z.object({
  // Weight in the user's current unit; sanity-bounded (≈1000 lb / 450 kg ceiling).
  weight: z.number().positive().max(1000),
  // Optional explicit day (YYYY-MM-DD); defaults to the user's local today.
  measuredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().trim().max(200).optional(),
});

// Bodyweight tracking (P4). Private trend data — NEVER fed into any leaderboard, XP, or
// public surface (see ED_SAFETY_REVIEW.md). One entry per local day, upserted.
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const day = parsed.data.measuredOn ?? resolveLocalDate(session.user.timezone);
  await recordBodyWeight(session.user.id, day, parsed.data.weight, parsed.data.note);
  return NextResponse.json({ ok: true }, { status: 200 });
}

const deleteSchema = z.object({ measuredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function DELETE(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  await deleteBodyWeight(session.user.id, parsed.data.measuredOn);
  return NextResponse.json({ ok: true }, { status: 200 });
}
