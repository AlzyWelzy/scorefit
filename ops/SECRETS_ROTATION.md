# Secrets — rotation & leak response

Production secrets live **only** in Vercel project env vars (and the Neon/Upstash
dashboards). They must never be committed. `.env.local` is git-ignored, and CI runs secret
scanning to catch accidental commits.

## Inventory

| Secret | Where used | Rotate at |
|---|---|---|
| `DATABASE_URL` | app + migrations | Neon → Roles → reset password |
| `AUTH_SECRET` | JWT signing (Auth.js) | generate new (`openssl rand -base64 48`) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | rate limiting | Upstash console → rotate token |
| `SMTP_*` | transactional email | mail provider dashboard |
| `CRON_SECRET` | cron auth header | generate new; update Vercel cron config |
| `SENTRY_DSN` | error reporting | Sentry project settings |

## If a secret leaks (do this immediately)

1. **Rotate it at the source** (see table). For `DATABASE_URL`, use the
   [DB password playbook](#db-password-no-downtime-rotation) below.
2. **Update Vercel** → Settings → Environment Variables (Production) → new value → **redeploy**.
3. **Update local** `.env.local`.
4. If `AUTH_SECRET` changed, every JWT is now invalid — users simply re-login (expected).
5. **Purge from git history if it was committed** (BFG / `git filter-repo`), then force-push
   and notify collaborators. Rotation (step 1) is what actually protects you — assume
   anything committed is compromised forever.

## DB password (no-downtime rotation)

1. Neon → **Roles** → reset password for `neondb_owner` (or create a new role with the same
   grants).
2. Set the new `DATABASE_URL` in **Vercel (Production)** and redeploy.
3. Verify: `curl -fsS https://scorefit.net/api/ops/health` returns `{"ok":true}`.
4. Update `.env.local`.
5. (If you created a new role) drop the old one once nothing uses it.

## Prevention (wired in CI)

- **Secret scanning** runs on every PR/push (`.github/workflows/ci.yml` → `secrets` job).
- **`.env*` is git-ignored**; never `git add -f` an env file.
- Optional local **pre-commit hook**: `gitleaks protect --staged` or `trufflehog git file://. --since-commit HEAD`.
