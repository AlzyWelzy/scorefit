import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { follow, unfollow } from "@/db/social";
import { getUserById } from "@/db/users";
import { featureEnabledFor } from "@/lib/flags";
import { sameOrigin, rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({ targetUserId: z.string().uuid(), action: z.enum(["follow", "unfollow"]) });

// Follow / unfollow. Gated by SOCIAL_ENABLED (or the per-user allowlist) and rate-limited.
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getUserById(session.user.id);
  if (!me || !featureEnabledFor("social", me.featureAllowlist)) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  if (me.suspendedSocialAt) return NextResponse.json({ error: "Social access suspended." }, { status: 403 });
  // Sybil/anti-abuse gate: social participation requires a verified email.
  if (!me.emailVerified) return NextResponse.json({ error: "Verify your email to use social features." }, { status: 403 });

  const ip = await clientIp();
  const rl = await rateLimit("follow", `${ip}:${session.user.id}`, 60, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Slow down." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (parsed.data.action === "follow") await follow(session.user.id, parsed.data.targetUserId);
  else await unfollow(session.user.id, parsed.data.targetUserId);

  return NextResponse.json({ ok: true }, { status: 200 });
}
