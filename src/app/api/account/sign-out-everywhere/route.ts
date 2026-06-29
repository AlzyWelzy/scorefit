import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { bumpTokenVersion } from "@/db/users";
import { sameOrigin } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Invalidate every session for the current user (bumps tokenVersion). The caller signs
// out locally afterward; other devices drop within the JWT re-check window.
export async function POST() {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await bumpTokenVersion(session.user.id);
  return NextResponse.json({ ok: true }, { status: 200 });
}
