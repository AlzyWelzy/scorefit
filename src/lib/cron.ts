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

/**
 * Run a cron body with a soft timeout BELOW Vercel's 30s hard kill, so a long-running job
 * (e.g. reconcile scanning every user) surfaces a logged timeout + 500 instead of being
 * silently terminated mid-flight. The underlying work can't be truly cancelled, but the
 * crons are idempotent/resumable, so the next scheduled run picks up where this left off.
 */
export async function withCronTimeout<T>(label: string, fn: () => Promise<T>, ms = 25_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`cron "${label}" exceeded ${ms}ms (soft timeout)`)), ms);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
