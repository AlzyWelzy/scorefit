import { NextResponse, after } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { issueToken } from "@/db/tokens";
import { sendVerificationCode } from "@/lib/mailer";
import { rateLimit, clientIp, sameOrigin } from "@/lib/rateLimit";
import { captureException } from "@/lib/observability";
import { isPwnedPassword } from "@/lib/pwned";

export const runtime = "nodejs";

const schema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1).max(80).optional(),
  // Birth year captured at registration so the age cohort is known up front. Stored
  // (year only — never full DOB); it does NOT block account creation, but gates the
  // public/social surfaces (leaderboards) for under-MIN_AGE users. Optional for now
  // so existing clients keep working; the form collects it.
  birthYear: z.number().int().min(1900).max(new Date().getUTCFullYear()).optional(),
});

export async function POST(req: Request) {
  if (!(await sameOrigin())) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  // Rate limit by IP: 5 signups / 10 min.
  const ip = await clientIp();
  const rl = await rateLimit("register", ip, 5, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const email = parsed.data.email.toLowerCase();

  // Reject passwords known to be in a breach corpus (HIBP k-anonymity; fails open). Runs
  // for every request regardless of email, so it adds no enumeration signal.
  if (await isPwnedPassword(parsed.data.password)) {
    return NextResponse.json(
      { error: "That password has appeared in a data breach. Please choose a different one." },
      { status: 400 },
    );
  }

  // Always pay the hash cost so taken/available emails take comparable time
  // (no timing oracle) and the create path is atomic via onConflictDoNothing.
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const inserted = await db
    .insert(users)
    .values({ email, passwordHash, name: parsed.data.name, birthYear: parsed.data.birthYear })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });

  // Newly created → send verification code. Already existed → say nothing
  // different (enumeration-safe), and skip the email. The token issue + email send run
  // out-of-band (after the response) so a new vs. already-registered address take the
  // same time on the wire — SMTP latency can't be used as an enumeration oracle.
  if (inserted[0]) {
    const userId = inserted[0].id;
    after(async () => {
      try {
        const code = await issueToken(userId, "email_verify");
        await sendVerificationCode(email, code);
      } catch (err) {
        // Don't fail registration if email delivery hiccups; they can resend.
        await captureException(err, { where: "register.verifyEmail" });
      }
    });
  }

  // Identical response whether or not the email was already registered.
  return NextResponse.json({ ok: true }, { status: 201 });
}
