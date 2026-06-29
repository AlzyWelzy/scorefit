import { NextResponse, after } from "next/server";
import { z } from "zod";
import { getUserByEmail } from "@/db/users";
import { issueToken } from "@/db/tokens";
import { sendPasswordResetCode } from "@/lib/mailer";
import { rateLimit, clientIp, sameOrigin } from "@/lib/rateLimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { captureException } from "@/lib/observability";

export const runtime = "nodejs";

const schema = z.object({ email: z.email(), turnstileToken: z.string().optional() });

// POST { email } → if the account exists, email a reset code. Always returns
// the same response (enumeration-safe).
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });

  const ip = await clientIp();
  const rl = await rateLimit("forgot-password", ip, 5, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });

  if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) {
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 403 });
  }

  const user = await getUserByEmail(parsed.data.email);
  if (user && user.passwordHash) {
    const u = user;
    // Issue + send out-of-band (after the response) so an existing vs. unknown address
    // take the same time on the wire — SMTP latency can't leak which path was taken.
    after(async () => {
      try {
        const code = await issueToken(u.id, "password_reset");
        await sendPasswordResetCode(u.email, code);
      } catch (err) {
        await captureException(err, { where: "forgot-password.send" });
      }
    });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
