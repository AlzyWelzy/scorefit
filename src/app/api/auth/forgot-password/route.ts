import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserByEmail } from "@/db/users";
import { issueToken } from "@/db/tokens";
import { sendPasswordResetCode } from "@/lib/mailer";
import { rateLimit, clientIp, sameOrigin } from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().email() });

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

  const user = await getUserByEmail(parsed.data.email);
  if (user && user.passwordHash) {
    try {
      const code = await issueToken(user.id, "password_reset");
      await sendPasswordResetCode(user.email, code);
    } catch (err) {
      console.error("[forgot-password] send failed", err);
      // Still return ok to avoid leaking which path was taken.
    }
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
