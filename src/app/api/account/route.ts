import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getUserById, setName, setPendingEmail, setPasswordHash, setUnit } from "@/db/users";
import { issueToken } from "@/db/tokens";
import { sendVerificationCode } from "@/lib/mailer";
import { sameOrigin } from "@/lib/rateLimit";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).nullable().optional(),
  email: z.email().optional(),
  unit: z.enum(["kg", "lb"]).optional(),
  // Required only when changing email or password.
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

export async function PATCH(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { name, email, unit, currentPassword, newPassword } = parsed.data;
  const user = await getUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Sensitive changes (email / password) require the current password.
  const sensitive = email !== undefined || newPassword !== undefined;
  if (sensitive) {
    if (!currentPassword || !user.passwordHash) {
      return NextResponse.json({ error: "Current password required." }, { status: 400 });
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  if (name !== undefined) await setName(user.id, name);
  if (unit !== undefined) await setUnit(user.id, unit);

  if (newPassword !== undefined) {
    await setPasswordHash(user.id, await bcrypt.hash(newPassword, 12));
  }

  let emailChanged = false;
  if (email !== undefined && email.toLowerCase() !== user.email) {
    const target = email.toLowerCase();
    // Report the same outcome whether or not the address is already registered,
    // so an authenticated user can't enumerate accounts via this endpoint.
    emailChanged = true;
    const taken = await db.select({ id: users.id }).from(users).where(eq(users.email, target)).limit(1);
    if (taken.length === 0) {
      // Stage the change as pending — the current verified email stays in place
      // until the code we email to the NEW address is confirmed (verify-email
      // applies the swap). This prevents an unverified/typo/attacker address
      // from taking over the account before it proves control.
      await setPendingEmail(user.id, target);
      try {
        // Distinct "email_change" token sent to the NEW address — kept separate
        // from "email_verify" so a current-email verification can't apply it.
        const code = await issueToken(user.id, "email_change");
        await sendVerificationCode(target, code);
      } catch (err) {
        console.error("[account] verification email failed", err);
      }
    }
    // If taken: silently do nothing, but still report success (masking).
  }

  return NextResponse.json({ ok: true, emailChanged }, { status: 200 });
}

const deleteSchema = z.object({ confirm: z.literal("DELETE"), password: z.string().optional() });

export async function DELETE(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }
  const user = await getUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // If the account has a password, require it to delete.
  if (user.passwordHash) {
    if (!parsed.data.password) {
      return NextResponse.json({ error: "Password required to delete." }, { status: 400 });
    }
    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Password is incorrect." }, { status: 400 });
  }

  // Imported lazily to keep the hot path small.
  const { deleteUser } = await import("@/db/users");
  await deleteUser(user.id);
  return NextResponse.json({ ok: true }, { status: 200 });
}
