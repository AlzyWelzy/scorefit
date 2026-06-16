import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { authConfig } from "@/auth.config";
import { db } from "@/db";
import { users } from "@/db/schema";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Rolling 30-day session; refreshed at most once a day. Single encrypted
  // httpOnly cookie (Auth.js default) — no separate access/refresh tokens.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
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
      // When the client calls useSession().update(), re-read from the DB so
      // unit / verification changes from /account propagate without re-login.
      if (trigger === "update" && t.sub) {
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
