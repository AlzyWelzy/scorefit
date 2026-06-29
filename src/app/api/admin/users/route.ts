import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isUserAdmin, isUserModerator, setAdmin, setRole, setSocialSuspension, logAdminAction } from "@/db/moderation";
import { deleteUser } from "@/db/users";
import { sameOrigin } from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["suspend", "unsuspend", "grantAdmin", "revokeAdmin", "delete", "setRole"]),
  role: z.enum(["user", "moderator", "admin"]).optional(),
});

// User management. Moderators may suspend/lift social privileges; only full admins may
// delete accounts or change roles. All checks read the live role (never the JWT).
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isUserModerator(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { userId, action, role } = parsed.data;

  // Destructive / privilege-changing actions are admin-only; moderators can only suspend.
  const adminOnly = action === "grantAdmin" || action === "revokeAdmin" || action === "delete" || action === "setRole";
  if (adminOnly && !(await isUserAdmin(session.user.id))) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  // Guard foot-guns: an admin can't demote/delete themselves here (avoids self-lockout).
  const selfDemote = action === "setRole" && role !== "admin";
  if (userId === session.user.id && (action === "revokeAdmin" || action === "delete" || selfDemote)) {
    return NextResponse.json({ error: "You can't do that to your own account here." }, { status: 400 });
  }

  switch (action) {
    case "suspend":
      await setSocialSuspension(userId, true);
      break;
    case "unsuspend":
      await setSocialSuspension(userId, false);
      break;
    case "grantAdmin":
      await setAdmin(userId, true);
      break;
    case "revokeAdmin":
      await setAdmin(userId, false);
      break;
    case "setRole":
      if (!role) return NextResponse.json({ error: "Missing role" }, { status: 400 });
      await setRole(userId, role);
      break;
    case "delete":
      await deleteUser(userId);
      break;
  }

  await logAdminAction({
    adminId: session.user.id,
    action: `user.${action}`,
    targetType: "user",
    targetId: userId,
    detail: action === "setRole" ? { role } : undefined,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
