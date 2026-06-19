// Lightweight fixed-window rate limiter. In-memory by default (fine for a
// single instance / dev); if UPSTASH_REDIS_REST_URL + _TOKEN are set we use
// Upstash's REST API so it works across serverless instances.
//
// Returns { ok, remaining, retryAfter }. If Upstash is configured but errors,
// we DEGRADE to the in-memory limiter for that request rather than failing open
// (a brute-force window) or failing closed (a total auth lockout on a Redis
// blip). In-memory limiting during an outage is per-instance but still bounded.

import { headers } from "next/headers";
import { captureException } from "@/lib/observability";

export type RateResult = { ok: boolean; remaining: number; retryAfter: number };

const buckets = new Map<string, { count: number; resetAt: number }>();

// Opportunistically evict expired buckets so a long-running single instance
// doesn't accumulate one entry per distinct IP/email key forever.
let lastSweep = 0;
function sweepExpired(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

function memoryLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweepExpired(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - b.count, retryAfter: 0 };
}

async function upstashLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const windowSec = Math.ceil(windowMs / 1000);
  // INCR then set EXPIRE only on first hit, via a pipeline.
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, windowSec, "NX"],
      ["TTL", key],
    ]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const out = (await res.json()) as { result: unknown }[];
  // A degraded 200 with a malformed/partial body must be treated as a limiter
  // failure (→ in-memory fallback), NOT coalesced to count 0 = allow.
  const rawCount = out[0]?.result;
  if (typeof rawCount !== "number" || !Number.isFinite(rawCount)) {
    throw new Error("upstash malformed pipeline result");
  }
  const count = rawCount;
  const ttl = Number(out[2]?.result ?? windowSec);
  if (count > limit) {
    return { ok: false, remaining: 0, retryAfter: ttl > 0 ? ttl : windowSec };
  }
  return { ok: true, remaining: Math.max(0, limit - count), retryAfter: 0 };
}

/**
 * @param name   logical bucket name (e.g. "register", "login")
 * @param id     per-caller key (IP, email, or both)
 * @param limit  max requests per window
 * @param windowMs window length in ms
 */
let warnedUnshared = false;
function warnIfUnsharedInProd() {
  if (warnedUnshared || process.env.NODE_ENV !== "production") return;
  warnedUnshared = true;
  console.warn(
    "[rateLimit] No UPSTASH_REDIS_REST_URL/_TOKEN set — rate limiting is in-memory and per-instance, " +
      "so it is ineffective across serverless/multi-instance deployments. Configure Upstash for production.",
  );
}

let lastFallbackLog = 0;
function logUpstashFallback(err: unknown) {
  // Throttle so an outage doesn't flood logs, but stays observable to operators.
  const now = Date.now();
  if (now - lastFallbackLog < 30_000) return;
  lastFallbackLog = now;
  void captureException(err, { where: "rateLimit.upstashFallback" });
}

export async function rateLimit(
  name: string,
  id: string,
  limit: number,
  windowMs: number,
): Promise<RateResult> {
  const key = `rl:${name}:${id}`;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await upstashLimit(key, limit, windowMs);
    } catch (err) {
      // Redis blip / degraded response → degrade to per-instance in-memory
      // limiting (still bounded) rather than locking out all auth or opening a
      // brute-force window. Logged (throttled) so the outage is visible.
      logUpstashFallback(err);
      return memoryLimit(key, limit, windowMs);
    }
  }
  warnIfUnsharedInProd();
  return memoryLimit(key, limit, windowMs);
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

/** True if the request's Origin matches the app origin (CSRF defence for JSON routes). */
export async function sameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) {
    // No Origin header — fall back to Sec-Fetch-Site, which every modern browser
    // sends on state-changing requests. Default-deny when BOTH are absent (a
    // non-browser client stripping headers) rather than treating it as same-origin.
    const site = h.get("sec-fetch-site");
    return site === "same-origin" || site === "same-site";
  }
  const host = h.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
