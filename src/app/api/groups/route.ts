import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { createGroup } from "@/db/groups";
import { getUserById } from "@/db/users";
import { featureEnabledFor } from "@/lib/flags";
import { sameOrigin, rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1, "Name your group").max(60),
  kind: z.enum(["crew", "coaching"]),
});

// Create a group/club. Gated by SOCIAL_ENABLED (or per-user allowlist), requires a
// verified email, and rate-limited so the table can't be flooded.
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getUserById(session.user.id);
  if (!me || !featureEnabledFor("social", me.featureAllowlist)) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  if (me.suspendedSocialAt) return NextResponse.json({ error: "Social access suspended." }, { status: 403 });
  if (!me.emailVerified) return NextResponse.json({ error: "Verify your email to use social features." }, { status: 403 });

  const ip = await clientIp();
  const rl = await rateLimit("group-create", `${ip}:${session.user.id}`, 10, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Slow down." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const res = await createGroup(session.user.id, parsed.data.name, parsed.data.kind);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: res.id }, { status: 201 });
}
