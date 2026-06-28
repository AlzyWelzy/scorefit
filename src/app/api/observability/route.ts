import { NextResponse } from "next/server";
import { z } from "zod";
import { captureException } from "@/lib/observability";
import { sameOrigin, rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Sink for CLIENT-side render errors (the error.tsx / global-error.tsx boundaries).
// captureException is server-only, so client crashes must hop through here to reach
// the same observability seam (structured logs + Sentry when configured). Same-origin
// + rate limited so it can't be turned into a log-spam / cost vector.
const schema = z.object({
  message: z.string().max(2000),
  stack: z.string().max(8000).optional(),
  where: z.string().max(120).optional(),
  digest: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  if (!(await sameOrigin())) return new NextResponse(null, { status: 403 });

  const ip = await clientIp();
  const rl = await rateLimit("client-error", ip, 30, 5 * 60 * 1000);
  if (!rl.ok) return new NextResponse(null, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const { message, stack, where, digest } = parsed.data;
  // Reconstruct a server-side Error carrying the client's message/stack so the
  // existing reporter formats it identically to server errors.
  const err = new Error(message);
  if (stack) err.stack = stack;
  await captureException(err, {
    where: where ?? "client.errorBoundary",
    extra: { digest, clientReported: true },
  });

  return new NextResponse(null, { status: 204 });
}
