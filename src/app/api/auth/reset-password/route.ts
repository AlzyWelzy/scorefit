import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getUserByEmail, setPasswordHash, markEmailVerified } from "@/db/users";
import { verifyToken } from "@/db/tokens";
import { rateLimit, clientIp, sameOrigin } from "@/lib/rateLimit";
import { isPwnedPassword } from "@/lib/pwned";

export const runtime = "nodejs";

const schema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// POST { email, code, password } → verify the reset OTP and set a new password.
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });

  const ip = await clientIp();
  const rl = await rateLimit("reset-password", ip, 10, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // Reject breached passwords (HIBP k-anonymity; fails open). Password-only signal, so it
  // doesn't leak whether the account/code is valid.
  if (await isPwnedPassword(parsed.data.password)) {
    return NextResponse.json(
      { error: "That password has appeared in a data breach. Please choose a different one." },
      { status: 400 },
    );
  }

  const user = await getUserByEmail(parsed.data.email);
  // Generic failure message regardless of whether the email exists.
  const genericFail = NextResponse.json(
    { error: "Invalid or expired code." },
    { status: 400 },
  );
  if (!user) return genericFail;

  const result = await verifyToken(user.id, "password_reset", parsed.data.code);
  if (!result.ok) return genericFail;

  await setPasswordHash(user.id, await bcrypt.hash(parsed.data.password, 12));
  // Proving control of the inbox also verifies the email.
  if (!user.emailVerified) await markEmailVerified(user.id);

  return NextResponse.json({ ok: true }, { status: 200 });
}
