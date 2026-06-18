import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import { getUserById, setName, setPendingEmail, setPasswordHash, changeUnit, setTimezone, updateLeaderboardProfile, setGamificationOptOut, emailExists } from "@/db/users";
import { issueToken } from "@/db/tokens";
import { sendVerificationCode } from "@/lib/mailer";
import { sameOrigin, rateLimit, clientIp } from "@/lib/rateLimit";
import { isValidTimeZone } from "@/lib/time";
import { MIN_AGE, meetsMinAge } from "@/lib/flags";

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).nullable().optional(),
  email: z.email().optional(),
  unit: z.enum(["kg", "lb"]).optional(),
  // IANA timezone, captured client-side and refined server-side (must be a real
  // zone). Non-sensitive; used to bucket sessions/streaks into the local day.
  timezone: z.string().min(1).max(64).optional(),
  // (Gated) leaderboard consent profile.
  leaderboardOptIn: z.boolean().optional(),
  displayName: z.string().trim().min(2).max(24).nullable().optional(),
  birthYear: z.number().int().min(1900).max(2100).optional(),
  // Hard anti-compulsion switch — turns off all gamification mechanics for the user.
  gamificationOptOut: z.boolean().optional(),
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
  const { name, email, unit, timezone, leaderboardOptIn, displayName, birthYear, gamificationOptOut, currentPassword, newPassword } = parsed.data;
  if (timezone !== undefined && !isValidTimeZone(timezone)) {
    return NextResponse.json({ error: "Invalid timezone." }, { status: 400 });
  }
  const user = await getUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Can't join a public board while gamification is (being) turned off — the board
  // is fed by the very mechanics the switch disables. Reject the contradiction.
  const willBeOptedOut = gamificationOptOut ?? user.gamificationOptOut;
  if (leaderboardOptIn === true && willBeOptedOut) {
    return NextResponse.json(
      { error: "Re-enable gamification before joining the leaderboards." },
      { status: 400 },
    );
  }

  // Age gate: joining the leaderboards (a public surface) requires an age >= MIN_AGE.
  if (leaderboardOptIn === true) {
    const by = birthYear ?? user.birthYear ?? undefined;
    if (!by) {
      return NextResponse.json({ error: "Birth year is required to join leaderboards." }, { status: 400 });
    }
    if (!meetsMinAge(by)) {
      return NextResponse.json({ error: `You must be at least ${MIN_AGE} to join leaderboards.` }, { status: 403 });
    }
  }

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
  // Switching units converts stored loads so the same physical weight is preserved.
  if (unit !== undefined && unit !== user.unit) await changeUnit(user.id, user.unit as "kg" | "lb", unit);
  if (timezone !== undefined && timezone !== user.timezone) await setTimezone(user.id, timezone);
  // Apply the gamification switch first so opting out can force-clear the board opt-in
  // before any leaderboard-profile update in the same request is considered.
  if (gamificationOptOut !== undefined && gamificationOptOut !== user.gamificationOptOut) {
    await setGamificationOptOut(user.id, gamificationOptOut);
  }
  if (leaderboardOptIn !== undefined || displayName !== undefined || birthYear !== undefined) {
    await updateLeaderboardProfile(user.id, { optIn: leaderboardOptIn, displayName, birthYear });
  }

  if (newPassword !== undefined) {
    await setPasswordHash(user.id, await bcrypt.hash(newPassword, 12));
  }

  let emailChanged = false;
  if (email !== undefined && email.toLowerCase() !== user.email) {
    const target = email.toLowerCase();
    // Rate-limit changes: bounds verification-email volume to arbitrary addresses
    // and the rate at which the (masked) endpoint can be probed.
    const ip = await clientIp();
    const rl = await rateLimit("email-change", `${ip}:${user.id}`, 5, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Too many changes. Try again later." }, { status: 429 });
    }
    // Stage the change as pending — the current verified email stays in place
    // until the code emailed to the NEW address is confirmed (verify-email applies
    // the swap). Stage + issue the token IDENTICALLY whether or not the address is
    // already registered, so neither the response nor downstream pendingEmail-
    // derived behavior leaks account existence. Uniqueness is enforced atomically
    // at apply time (applyPendingEmail throws on the unique violation).
    emailChanged = true;
    await setPendingEmail(user.id, target);
    const code = await issueToken(user.id, "email_change");
    if (!(await emailExists(target))) {
      // Only actually email the code when the address is free — never message the
      // existing owner of a taken address.
      try {
        await sendVerificationCode(target, code);
      } catch (err) {
        console.error("[account] verification email failed", err);
      }
    }
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
