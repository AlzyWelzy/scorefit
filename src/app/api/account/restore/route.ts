import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cancelAccountDeletion } from "@/db/users";
import { sameOrigin } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Cancel a pending account deletion (during the grace window).
export async function POST() {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await cancelAccountDeletion(session.user.id);
  return NextResponse.json({ ok: true }, { status: 200 });
}
