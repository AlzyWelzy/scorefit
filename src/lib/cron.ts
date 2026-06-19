import "server-only";
import { timingSafeEqual } from "crypto";

/**
 * Authorize a cron request. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 * We require CRON_SECRET to be set AND to match (constant-time). Returns false (deny)
 * when the secret isn't configured, so an unprotected route can't be hit by accident.
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
