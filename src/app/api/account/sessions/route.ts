import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { revokeLoginSession } from "@/db/users";
import { sameOrigin } from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({ sessionId: z.string().uuid() });

// Revoke one of your own device sessions (the device signs out within the revocation window).
export async function DELETE(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await revokeLoginSession(session.user.id, parsed.data.sessionId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
