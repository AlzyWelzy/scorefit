import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  getUserById,
  markEmailVerified,
  applyPendingEmail,
  setPendingEmail,
  emailExists,
} from "@/db/users";
import { issueToken, verifyToken, consumeToken, type VerifyResult } from "@/db/tokens";
import { sendVerificationCode } from "@/lib/mailer";
import { rateLimit, clientIp, sameOrigin } from "@/lib/rateLimit";
import { captureException } from "@/lib/observability";

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
  const code = parsed.data.code;

  const user = await getUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1) If an email change is pending, the code may be the one sent to the NEW
  //    address under a DISTINCT "email_change" token. A match swaps the address
  //    in. Keeping it separate from "email_verify" is what stops a normal
  //    verification from ever applying a stale/abandoned pending change.
  let change: VerifyResult | null = null;
  if (user.pendingEmail) {
    // Read-only peek: don't consume (so a failed apply doesn't burn the code)
    // and don't count attempts (so trying the CURRENT-email code here can't lock
    // the email_change token — the two purposes stay independent). Brute-force of
    // the change code is bounded by the verify-email + email-change rate limits.
    change = await verifyToken(user.id, "email_change", code, { consume: false, countAttempts: false });
    if (change.ok) {
      let applied: boolean;
      try {
        applied = await applyPendingEmail(user.id, user.pendingEmail);
      } catch (err) {
        if ((err as { code?: string }).code === "23505") {
          // The new address was claimed by someone else in the race — the change
          // can never succeed, so drop it and consume the now-useless token.
          await setPendingEmail(user.id, null);
          await consumeToken(user.id, "email_change");
          return NextResponse.json({ error: "That email is no longer available." }, { status: 409 });
        }
        // Transient failure — do NOT consume the token, so the same code can retry.
        await captureException(err, { where: "verify-email.applyPendingEmail" });
        return NextResponse.json({ error: "Could not update your email. Try again." }, { status: 500 });
      }
      if (!applied) {
        // pendingEmail was changed/cleared concurrently — don't consume; retry.
        return NextResponse.json({ error: "Please try again." }, { status: 409 });
      }
      await consumeToken(user.id, "email_change");
      return NextResponse.json({ ok: true, emailChanged: true }, { status: 200 });
    }
    // Stale/abandoned change → drop the pending so it can't linger.
    if (change.reason === "no_token" || change.reason === "expired") {
      await setPendingEmail(user.id, null);
    }
  }

  // 2) Always try verifying the CURRENT email too. This runs even when a change
  //    is pending (the entered code may be the current-email code), so a pending
  //    change never blocks normal verification — yet a current-email code can
  //    never apply the pending change (only step 1's email_change match does).
  const result = await verifyToken(session.user.id, "email_verify", code);
  if (result.ok) {
    await markEmailVerified(session.user.id);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Neither matched. Use ONE generic message regardless of reason/path: a taken
  // vs. available target address would otherwise produce different errors here
  // ("no active code" vs "incorrect code"), re-leaking the enumeration the PATCH
  // endpoint masks.
  return NextResponse.json(
    { error: "That code is incorrect or has expired. Request a new one if needed." },
    { status: 400 },
  );
}

// DELETE → cancel an in-progress email change, keeping the current address.
export async function DELETE() {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await setPendingEmail(session.user.id, null);
  await consumeToken(session.user.id, "email_change");
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

  // During an email change, resend the change code to the new (pending) address
  // under the "email_change" token. Otherwise resend a current-email code.
  const changing = !!user.pendingEmail;
  if (!changing && user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true }, { status: 200 });
  }
  const purpose = changing ? "email_change" : "email_verify";
  const target = changing ? user.pendingEmail! : user.email;

  try {
    const code = await issueToken(user.id, purpose);
    // For an email change, only actually send when the new address is free —
    // never message the existing owner of a taken address. The response is
    // identical either way, so it doesn't leak whether the address is registered.
    if (!changing || !(await emailExists(target))) {
      await sendVerificationCode(target, code);
    }
  } catch (err) {
    await captureException(err, { where: "verify-email.resend" });
    return NextResponse.json({ error: "Could not send the email. Try again later." }, { status: 502 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
