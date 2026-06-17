import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { verifyToken } from "@/db/tokens";
import { rateLimit, clientIp, sameOrigin } from "@/lib/rateLimit";
import { verifyTotp, decryptSecret } from "@/lib/totp";
import { enableTwoFactor, generateBackupCodes } from "@/db/twoFactor";

export const runtime = "nodejs";

const schema = z.object({
  method: z.enum(["email", "totp"]),
  code: z.string().min(6).max(9),
});

// POST → confirm the setup code for the chosen method, enable 2FA, and return
// a fresh set of one-time backup codes (shown to the user exactly once).
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Throttle confirm-code attempts so a hijacked session can't brute-force the
  // 6-digit setup code (the TOTP path has no per-token counter of its own).
  const ip = await clientIp();
  const rl = await rateLimit("2fa-confirm", `${ip}:${session.user.id}`, 10, 10 * 60 * 1000, {
    failClosed: true,
  });
  if (!rl.ok) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter the code." }, { status: 400 });
  const { method, code } = parsed.data;

  let ok = false;
  if (method === "totp") {
    if (!user.totpSecret) return NextResponse.json({ error: "Start setup again." }, { status: 400 });
    try {
      // Confirm only proves possession — don't persist a step floor here, or the
      // first real login with the same still-valid code would be rejected. The
      // single-use baseline is established by that first login instead.
      ok = verifyTotp(decryptSecret(user.totpSecret), code.trim()) !== null;
    } catch {
      ok = false;
    }
  } else {
    const res = await verifyToken(user.id, "two_factor", code.trim());
    ok = res.ok;
  }

  if (!ok) return NextResponse.json({ error: "Incorrect code. Try again." }, { status: 400 });

  await enableTwoFactor(user.id, method);
  const backupCodes = await generateBackupCodes(user.id, 10);
  return NextResponse.json({ ok: true, method, backupCodes });
}
