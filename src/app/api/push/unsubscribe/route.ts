import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { sameOrigin } from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({ endpoint: z.string().url().max(1000) });

// Remove a web-push subscription (only your own).
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, parsed.data.endpoint), eq(pushSubscriptions.userId, session.user.id)));

  return NextResponse.json({ ok: true }, { status: 200 });
}
