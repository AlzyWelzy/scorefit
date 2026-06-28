import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { joinGroup, leaveGroup, setCoachConsent, removeMember, setMemberRole, deleteGroup } from "@/db/groups";
import { getUserById } from "@/db/users";
import { featureEnabledFor } from "@/lib/flags";
import { sameOrigin, rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["join", "leave", "consent", "remove", "setRole"]),
  shares: z.boolean().optional(),
  targetUserId: z.string().uuid().optional(),
  role: z.enum(["coach", "member"]).optional(),
});

// Shared social gate (matches /api/social/*): flag on, not suspended, email verified.
async function gate() {
  if (!(await sameOrigin())) return { status: 403 as const, error: "Bad origin" };
  const session = await auth();
  if (!session?.user?.id) return { status: 401 as const, error: "Unauthorized" };
  const me = await getUserById(session.user.id);
  if (!me || !featureEnabledFor("social", me.featureAllowlist)) return { status: 404 as const, error: "Not available" };
  if (me.suspendedSocialAt) return { status: 403 as const, error: "Social access suspended." };
  if (!me.emailVerified) return { status: 403 as const, error: "Verify your email to use social features." };
  return { status: 200 as const, userId: session.user.id };
}

// Member/owner actions on a group: join, leave, coach-consent toggle, remove member, set role.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.status !== 200) return NextResponse.json({ error: g.error }, { status: g.status });
  const { id } = await params;

  const ip = await clientIp();
  const rl = await rateLimit("group-action", `${ip}:${g.userId}`, 60, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Slow down." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  let res: { ok: true } | { error: string } | undefined;
  switch (parsed.data.action) {
    case "join":
      res = await joinGroup(id, g.userId);
      break;
    case "leave":
      res = await leaveGroup(id, g.userId);
      break;
    case "consent":
      if (typeof parsed.data.shares !== "boolean") return NextResponse.json({ error: "Missing consent value" }, { status: 400 });
      res = await setCoachConsent(id, g.userId, parsed.data.shares);
      break;
    case "remove":
      if (!parsed.data.targetUserId) return NextResponse.json({ error: "Missing member" }, { status: 400 });
      res = await removeMember(id, g.userId, parsed.data.targetUserId);
      break;
    case "setRole":
      if (!parsed.data.targetUserId || !parsed.data.role) return NextResponse.json({ error: "Missing member or role" }, { status: 400 });
      res = await setMemberRole(id, g.userId, parsed.data.targetUserId, parsed.data.role);
      break;
  }
  if (!res) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true }, { status: 200 });
}

// Delete a group (owner only).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.status !== 200) return NextResponse.json({ error: g.error }, { status: g.status });
  const { id } = await params;
  const res = await deleteGroup(id, g.userId);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true }, { status: 200 });
}
