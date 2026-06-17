import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getUserByEmail } from "@/db/users";
import { issueToken } from "@/db/tokens";
import { sendMail } from "@/lib/mailer";
import { signPending, PENDING_2FA_COOKIE } from "@/lib/pending2fa";
import { rateLimit, clientIp, sameOrigin } from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({ email: z.email(), password: z.string().min(8) });

// Step 1 of login. Verifies the password WITHOUT issuing a session. If 2FA is
// on, sets a short-lived pending cookie (and emails a code for the email
// method) and tells the client to go to /login/2fa. If 2FA is off, tells the
// client to do the normal signIn(). Response is uniform on bad credentials.
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });

  const ip = await clientIp();
  const rl = await rateLimit("2fa-start", ip, 20, 10 * 60 * 1000, { failClosed: true });
  if (!rl.ok) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const user = await getUserByEmail(parsed.data.email);
  const valid = user?.passwordHash
    ? await bcrypt.compare(parsed.data.password, user.passwordHash)
    : false;

  if (!user || !valid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (!user.twoFactorEnabled || !user.twoFactorMethod) {
    // No second factor — the client should call signIn() directly.
    return NextResponse.json({ next: "signin" }, { status: 200 });
  }

  // 2FA required: bind a pending proof to this user and prep the factor.
  if (user.twoFactorMethod === "email") {
    try {
      const code = await issueToken(user.id, "two_factor");
      await sendMail({
        to: user.email,
        subject: "Your ScoreFit sign-in code",
        text: `Your ScoreFit sign-in code is ${code}. It expires in 10 minutes.`,
        html: `<p>Your ScoreFit sign-in code is <b style="font-size:20px;letter-spacing:4px">${code}</b>. It expires in 10 minutes.</p>`,
      });
    } catch (err) {
      console.error("[2fa-start] email send failed", err);
      return NextResponse.json({ error: "Could not send your code. Try again." }, { status: 502 });
    }
  }

  const res = NextResponse.json({ next: "2fa", method: user.twoFactorMethod }, { status: 200 });
  res.cookies.set(PENDING_2FA_COOKIE, signPending(user.id, user.twoFactorMethod), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 5 * 60,
  });
  return res;
}
