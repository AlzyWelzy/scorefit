import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isUserAdmin, setAdmin, setSocialSuspension, logAdminAction } from "@/db/moderation";
import { deleteUser } from "@/db/users";
import { sameOrigin } from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["suspend", "unsuspend", "grantAdmin", "revokeAdmin", "delete"]),
});

// Admin-only user management: suspend/lift social privileges, grant/revoke admin, or
// delete an account. Gated on the live isAdmin flag (read fresh, never from the JWT).
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isUserAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { userId, action } = parsed.data;

  // Guard foot-guns: an admin can't revoke their own admin or delete themselves here
  // (avoids locking yourself out / accidental self-deletion; use account settings).
  if (userId === session.user.id && (action === "revokeAdmin" || action === "delete")) {
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
    case "delete":
      await deleteUser(userId);
      break;
  }

  await logAdminAction({ adminId: session.user.id, action: `user.${action}`, targetType: "user", targetId: userId });

  return NextResponse.json({ ok: true }, { status: 200 });
}
