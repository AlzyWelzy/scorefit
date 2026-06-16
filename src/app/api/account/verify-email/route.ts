import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getUserById, markEmailVerified } from "@/db/users";
import { issueToken, verifyToken } from "@/db/tokens";
import { sendVerificationCode } from "@/lib/mailer";
import { rateLimit, clientIp, sameOrigin } from "@/lib/rateLimit";

export const runtime = "nodejs";

const verifySchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code.") });

// POST { code } → verify the OTP and mark the email verified.
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = await clientIp();
  const rl = await rateLimit("verify-email", `${ip}:${session.user.id}`, 10, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid code" }, { status: 400 });
  }

  const result = await verifyToken(session.user.id, "email_verify", parsed.data.code);
  if (!result.ok) {
    const messages: Record<string, string> = {
      no_token: "No active code. Request a new one.",
      expired: "That code expired. Request a new one.",
      too_many_attempts: "Too many wrong attempts. Request a new code.",
      mismatch: "Incorrect code.",
    };
    return NextResponse.json({ error: messages[result.reason] ?? "Invalid code" }, { status: 400 });
  }

  await markEmailVerified(session.user.id);
  return NextResponse.json({ ok: true }, { status: 200 });
}

// PUT → resend a fresh verification code to the user's email.
export async function PUT() {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = await clientIp();
  const rl = await rateLimit("resend-verify", `${ip}:${session.user.id}`, 4, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Please wait before requesting another code." }, { status: 429 });
  }

  const user = await getUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true }, { status: 200 });

  try {
    const code = await issueToken(user.id, "email_verify");
    await sendVerificationCode(user.email, code);
  } catch (err) {
    console.error("[verify-email] resend failed", err);
    return NextResponse.json({ error: "Could not send the email. Try again later." }, { status: 502 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
