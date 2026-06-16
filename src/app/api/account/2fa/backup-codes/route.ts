import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { sameOrigin } from "@/lib/rateLimit";
import { generateBackupCodes } from "@/db/twoFactor";

export const runtime = "nodejs";

// POST → regenerate backup codes (invalidates old ones). Only when 2FA is on.
export async function POST() {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.twoFactorEnabled) {
    return NextResponse.json({ error: "Enable two-factor first." }, { status: 400 });
  }
  const backupCodes = await generateBackupCodes(user.id, 10);
  return NextResponse.json({ ok: true, backupCodes });
}
