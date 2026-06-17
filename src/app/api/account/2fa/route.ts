import { NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { getUserById } from "@/db/users";
import { issueToken } from "@/db/tokens";
import { sendMail } from "@/lib/mailer";
import { sameOrigin, rateLimit, clientIp } from "@/lib/rateLimit";
import { generateTotpSecret, encryptSecret, otpauthUri } from "@/lib/totp";
import { setTotpSecret, countBackupCodes } from "@/db/twoFactor";

export const runtime = "nodejs";

// GET → current 2FA status (method, enabled, remaining backup codes).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    enabled: user.twoFactorEnabled,
    method: user.twoFactorMethod,
    backupCodesRemaining: user.twoFactorEnabled ? await countBackupCodes(user.id) : 0,
  });
}

const beginSchema = z.object({ method: z.enum(["email", "totp"]) });

// POST → begin enabling/switching a method. For TOTP, generates a new secret
// (stored but not yet "enabled") and returns the QR + otpauth URI to confirm.
// For email, sends a code to confirm the user controls the inbox.
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Throttle enrollment starts: bounds the confirmation-email vector and brute force.
  const ip = await clientIp();
  const rl = await rateLimit("2fa-begin", `${ip}:${session.user.id}`, 5, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const user = await getUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = beginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid method" }, { status: 400 });

  if (parsed.data.method === "totp") {
    const secret = generateTotpSecret();
    await setTotpSecret(user.id, encryptSecret(secret));
    const uri = otpauthUri(secret, user.email);
    const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
    // Return the secret for manual entry; it's already stored encrypted.
    return NextResponse.json({ method: "totp", secret, otpauthUri: uri, qrDataUrl });
  }

  // email: send a confirmation code
  try {
    const code = await issueToken(user.id, "two_factor");
    await sendMail({
      to: user.email,
      subject: "Confirm email two-factor for ScoreFit",
      text: `Your ScoreFit confirmation code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your ScoreFit confirmation code is <b style="font-size:20px;letter-spacing:4px">${code}</b>. It expires in 10 minutes.</p>`,
    });
  } catch (err) {
    console.error("[2fa enable email] send failed", err);
    return NextResponse.json({ error: "Could not send the code." }, { status: 502 });
  }
  return NextResponse.json({ method: "email" });
}
