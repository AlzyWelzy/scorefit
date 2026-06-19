import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { setSwap } from "@/db/swaps";
import { getExercise, PROGRAM_IDS } from "@/lib/data";
import { sameOrigin } from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({
  program: z.enum(PROGRAM_IDS),
  daySlug: z.string().min(1).max(120),
  originalSlug: z.string().min(1).max(120),
  subSlug: z.string().min(1).max(120),
});

// Record (or clear) an exercise substitution. The logger/progress then follow the sub
// so prevLoads and history track the movement actually trained.
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  // The sub must be a real exercise (unless it equals the original, i.e. a reset).
  if (parsed.data.subSlug !== parsed.data.originalSlug && !getExercise(parsed.data.subSlug)) {
    return NextResponse.json({ error: "Unknown exercise." }, { status: 400 });
  }
  await setSwap(session.user.id, parsed.data.program, parsed.data.daySlug, parsed.data.originalSlug, parsed.data.subSlug);
  return NextResponse.json({ ok: true }, { status: 200 });
}
