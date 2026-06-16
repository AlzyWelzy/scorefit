import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { sameOrigin } from "@/lib/rateLimit";
import { disableTwoFactor } from "@/db/twoFactor";

export const runtime = "nodejs";

const schema = z.object({ password: z.string().min(1) });

// POST → disable 2FA. Requires the current password since it lowers account
// security; also clears the TOTP secret and all backup codes.
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Password required." }, { status: 400 });

  if (user.passwordHash) {
    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Password is incorrect." }, { status: 400 });
  }

  await disableTwoFactor(user.id);
  return NextResponse.json({ ok: true });
}
