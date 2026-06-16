import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { authConfig } from "@/auth.config";
import { db } from "@/db";
import { users } from "@/db/schema";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { verifyTotp, decryptSecret } from "@/lib/totp";
import { verifyToken } from "@/db/tokens";
import { consumeBackupCode } from "@/db/twoFactor";
import { verifyPending, PENDING_2FA_COOKIE } from "@/lib/pending2fa";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  // Present only on the 2FA second step.
  code: z.string().optional(),
});

// Verify a 2FA code against the user's configured method, or a backup code.
async function verifySecondFactor(
  user: typeof users.$inferSelect,
  code: string,
): Promise<boolean> {
  const clean = code.trim();
  // Backup codes are formatted XXXX-XXXX; try them first if it looks like one.
  if (/^[0-9a-zA-Z]{4}-?[0-9a-zA-Z]{4}$/.test(clean) && clean.includes("-")) {
    if (await consumeBackupCode(user.id, clean)) return true;
  }
  if (user.twoFactorMethod === "totp" && user.totpSecret) {
    try {
      if (verifyTotp(decryptSecret(user.totpSecret), clean)) return true;
    } catch {
      /* fall through */
    }
  }
  if (user.twoFactorMethod === "email") {
    const res = await verifyToken(user.id, "two_factor", clean);
    if (res.ok) return true;
  }
  // Last resort: also accept a backup code that wasn't dash-formatted.
  if (await consumeBackupCode(user.id, clean)) return true;
  return false;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Rolling 30-day session; refreshed at most once a day. Single encrypted
  // httpOnly cookie (Auth.js default) — no separate access/refresh tokens.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, code: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password, code } = parsed.data;
        // Throttle credential checks: 10 attempts / 10 min per IP+email.
        const ip = await clientIp();
        const rl = await rateLimit("login", `${ip}:${email.toLowerCase()}`, 10, 10 * 60 * 1000);
        if (!rl.ok) return null;
        const rows = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1);
        const user = rows[0];
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // Second-factor enforcement.
        if (user.twoFactorEnabled) {
          if (!code) return null; // must go through the /login/2fa step
          // The pending cookie proves the password step happened for THIS user
          // and binds the second factor to it.
          const jar = await cookies();
          const pending = verifyPending(jar.get(PENDING_2FA_COOKIE)?.value);
          if (!pending || pending.userId !== user.id) return null;
          const passed = await verifySecondFactor(user, code);
          if (!passed) return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          unit: user.unit as "kg" | "lb",
          verified: !!user.emailVerified,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Persist unit + verification on the token at sign-in; refresh on update().
    async jwt({ token, user, trigger }) {
      const t = token as typeof token & { unit?: "kg" | "lb"; verified?: boolean };
      if (user) {
        t.unit = (user as { unit?: "kg" | "lb" }).unit ?? "kg";
        t.verified = (user as { verified?: boolean }).verified ?? false;
      }
      // Re-read from the DB when:
      //  - the client called useSession().update() (unit/email changes), OR
      //  - the token still says unverified (so a verification done in another
      //    tab/device propagates without an explicit update() or re-login).
      // Once verified=true this branch stops running, so it's a bounded cost.
      const needsRefresh = trigger === "update" || t.verified === false || t.verified === undefined;
      if (needsRefresh && t.sub) {
        const fresh = await db
          .select({ unit: users.unit, emailVerified: users.emailVerified, email: users.email })
          .from(users)
          .where(eq(users.id, t.sub))
          .limit(1);
        if (fresh[0]) {
          t.unit = fresh[0].unit as "kg" | "lb";
          t.verified = !!fresh[0].emailVerified;
          t.email = fresh[0].email;
        }
      }
      return t;
    },
    // Auth.js sets token.sub to the user id on sign-in; expose it on the session.
    async session({ session, token }) {
      if (session.user && token.sub) {
        const t = token as { sub?: string; unit?: "kg" | "lb"; verified?: boolean };
        session.user.id = token.sub;
        session.user.unit = t.unit ?? "kg";
        session.user.verified = t.verified ?? false;
      }
      return session;
    },
  },
});
