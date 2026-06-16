import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getLogsForWeek, upsertSetLog } from "@/db/logs";
import { PROGRAM_IDS } from "@/lib/data";
import { sameOrigin } from "@/lib/rateLimit";

export const runtime = "nodejs";

const programEnum = z.enum(PROGRAM_IDS);

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const program = programEnum.safeParse(url.searchParams.get("program"));
  const week = z.coerce.number().int().min(1).max(52).safeParse(url.searchParams.get("week"));
  if (!program.success || !week.success) {
    return NextResponse.json({ error: "Bad query" }, { status: 400 });
  }
  const logs = await getLogsForWeek(session.user.id, program.data, week.data);
  return NextResponse.json({ logs });
}

const postSchema = z.object({
  program: programEnum,
  week: z.number().int().min(1).max(52),
  daySlug: z.string().min(1).max(120),
  exerciseSlug: z.string().min(1).max(120),
  setIndex: z.number().int().min(1).max(20),
  weight: z.number().min(0).max(2000).nullable().optional(),
  reps: z.number().int().min(0).max(1000).nullable().optional(),
  rpe: z.number().min(0).max(10).nullable().optional(),
  completed: z.boolean().optional(),
});

export async function POST(req: Request) {
  if (!(await sameOrigin())) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid log payload" }, { status: 400 });
  }
  const row = await upsertSetLog(session.user.id, parsed.data);
  return NextResponse.json({ log: row }, { status: 200 });
}
