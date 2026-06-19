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
import { advanceTotpStep } from "@/db/users";
import { consumeBackupCode } from "@/db/twoFactor";
import { verifyPending, PENDING_2FA_COOKIE } from "@/lib/pending2fa";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  // Present only on the 2FA second step. Bounded so an unbounded string can't be
  // fed into the verify path (TOTP is 6 digits, backup codes are 9 chars with dash).
  code: z.string().max(16).optional(),
});

// Verify a 2FA code against the user's configured method, or a backup code.
async function verifySecondFactor(
  user: typeof users.$inferSelect,
  code: string,
): Promise<boolean> {
  const clean = code.trim();
  if (user.twoFactorMethod === "totp" && user.totpSecret) {
    try {
      const step = verifyTotp(decryptSecret(user.totpSecret), clean);
      // Single-use: advanceTotpStep atomically rejects a step that isn't newer
      // than the last accepted one, so a captured code can't be replayed (even
      // by two concurrent requests racing within the drift window).
      if (step !== null && (await advanceTotpStep(user.id, step))) {
        return true;
      }
    } catch {
      /* fall through */
    }
  }
  if (user.twoFactorMethod === "email") {
    const res = await verifyToken(user.id, "two_factor", clean);
    if (res.ok) return true;
  }
  // Backup code fallback — consumeBackupCode normalises dashes/case, so a single
  // attempt covers both XXXX-XXXX and XXXXXXXX forms.
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
          timezone: user.timezone,
          verified: !!user.emailVerified,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Persist unit + verification + session version on the token at sign-in;
    // refresh on update() and on a bounded cadence (for revocation).
    async jwt({ token, user, trigger }) {
      // ver/verAt/unit/tz/verified are declared on the JWT (see next-auth.d.ts), so
      // no ad-hoc cast is needed here.
      const t = token;
      if (user) {
        t.unit = (user as { unit?: "kg" | "lb" }).unit ?? "kg";
        t.tz = (user as { timezone?: string }).timezone ?? "UTC";
        t.verified = (user as { verified?: boolean }).verified ?? false;
        t.ver = (user as { tokenVersion?: number }).tokenVersion ?? 0;
        t.verAt = Date.now();
      }
      // Re-read from the DB at most once per STALE_MS (or on an explicit
      // update()), so a password change — which bumps tokenVersion — revokes the
      // session within ~5 min at bounded cost. The read is wrapped so a transient
      // DB blip can't throw out of the callback and break auth site-wide.
      const STALE_MS = 5 * 60 * 1000;
      const verAt = typeof t.verAt === "number" ? t.verAt : undefined;
      const needsRefresh =
        trigger === "update" || verAt === undefined || Date.now() - verAt > STALE_MS;
      if (needsRefresh && t.sub) {
        let fresh;
        try {
          fresh = await db
            .select({
              unit: users.unit,
              timezone: users.timezone,
              emailVerified: users.emailVerified,
              email: users.email,
              tokenVersion: users.tokenVersion,
            })
            .from(users)
            .where(eq(users.id, t.sub))
            .limit(1);
        } catch {
          // Infrastructure error (pool/replica hiccup) — fail OPEN for
          // availability and retry next cycle, BUT cap how long a token may be
          // honored without a successful revocation check: past a hard ceiling,
          // force re-auth so a revoked session can't survive an extended outage.
          const HARD_CEILING_MS = 30 * 60 * 1000;
          if (verAt !== undefined && Date.now() - verAt > HARD_CEILING_MS) return null;
          return t;
        }
        // The read above succeeded (infra errors throw and are caught), so these
        // results are definitive. Revoke (Auth.js signs out on a null token) when:
        //  - the row is gone → the account was deleted, OR
        //  - tokenVersion changed → a password/email change since this token was
        //    minted. Legacy/pre-deploy tokens have ver=undefined → compared as 0,
        //    the post-migration default, so any later change still revokes them.
        if (!fresh[0]) return null;
        if (fresh[0].tokenVersion !== (t.ver ?? 0)) return null;
        t.unit = fresh[0].unit as "kg" | "lb";
        t.tz = fresh[0].timezone ?? "UTC";
        t.verified = !!fresh[0].emailVerified;
        t.email = fresh[0].email;
        t.ver = fresh[0].tokenVersion;
        t.verAt = Date.now();
      }
      return t;
    },
    // Auth.js sets token.sub to the user id on sign-in; expose it on the session.
    async session({ session, token }) {
      if (session.user && token.sub) {
        const t = token as { sub?: string; unit?: "kg" | "lb"; tz?: string; verified?: boolean };
        session.user.id = token.sub;
        session.user.unit = t.unit ?? "kg";
        session.user.timezone = t.tz ?? "UTC";
        session.user.verified = t.verified ?? false;
      }
      return session;
    },
  },
});
