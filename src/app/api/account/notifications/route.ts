import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { setNotificationPrefs } from "@/db/notifications";
import { sameOrigin } from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({
  reminders: z.boolean().optional(),
  digest: z.boolean().optional(),
  social: z.boolean().optional(),
});

// Update the signed-in user's notification channel preferences.
export async function PATCH(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  await setNotificationPrefs(session.user.id, parsed.data);
  return NextResponse.json({ ok: true }, { status: 200 });
}
