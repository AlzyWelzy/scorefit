# ScoreFit

A science-based hypertrophy training website built with **Next.js 16 (App Router)**, **React 19**, **TypeScript 6**, and **Tailwind CSS 4**. It contains the complete training system: two 12-week programs, all 53 exercises with real demo-video stills and click-to-play demos, and the full guidebook (principles, RPE scale, progression, gear, anatomy, nutrition, supplements, FAQ, references).

Domain target: **scorefit.net**

---

## What's inside

- **2 programs** (Beginner, Intermediate/Advanced) × **12 weeks** × **5 training days** — every prescription parsed from the source material (working sets, reps, warm-up sets, early/last-set RPE, rest, intensity technique, two substitutions, coaching notes).
- **53-exercise library**, grouped by movement pattern. Each exercise page shows the real demo video (click to play), the prescription, cues, substitutions, and links to every week it appears in.
- **Full guidebook** rendered from Markdown (tables, lists, the RPE scale, etc.).
- **98 statically prerendered pages** — fast, cacheable, SEO-ready (sitemap, robots, per-page metadata).
- **Performance**: every page is statically prerendered. Exercise stills load directly from the video CDN (no image-optimizer hop), lazily, at the right size, with the CDN preconnected — so image-heavy pages stay fast.
- **Design**: an "instrument / training-log" aesthetic — graphite base, ember accent (effort), teal reserved for data readouts; Space Grotesk / Inter / JetBrains Mono.

## Tech stack (pinned)

| Layer | Package | Version |
|---|---|---|
| Framework | next | 16.2.9 |
| UI runtime | react / react-dom | 19.2.7 |
| Language | typescript | 6.0 |
| Auth | next-auth (Auth.js v5) | 5.0.0-beta |
| ORM | drizzle-orm / drizzle-kit | 0.45 / 0.31 |
| Styling | tailwindcss + @tailwindcss/postcss | 4.3.1 |
| Animation | motion | 12.40 |
| Icons | lucide-react | 1.20 |
| Markdown | react-markdown + remark-gfm | 10.1 / 4.0 |
| Email | nodemailer | 9.0 |
| Validation | zod | 4.4 |
| Lint | eslint (flat config) + eslint-config-next | 9.39 / 16.2.9 |

Node.js **20.9+** required (24 LTS recommended; see `.nvmrc`).

> **Linting:** ESLint uses Next.js's native flat config (`eslint-config-next/core-web-vitals` + `/typescript`), so no `@eslint/eslintrc` shim is needed. ESLint stays on the 9.x line because `eslint-config-next@16.2.9`'s bundled plugins (react, import, jsx-a11y, react-hooks) don't yet declare ESLint 10 support.
>
> **`.npmrc`:** `legacy-peer-deps=true` is set because next-auth 5 (beta) pins `@auth/core`, which declares an *optional* peer on nodemailer ^7; this project doesn't use Auth.js's Nodemailer provider, so it runs the latest nodemailer 9. Remove once next-auth 5 stable widens that range.

---

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

```bash
npm run build        # production build (Turbopack)
npm start            # serve the production build
npm run lint         # ESLint (flat config)
npm run typecheck    # tsc --noEmit
```

## Project structure

```
src/
  app/                       # App Router pages
    page.tsx                 # landing
    programs/                # chooser, overview, week/[week]
    exercises/               # library, [slug] detail
    guidebook/               # index, [section]
    sitemap.ts / robots.ts
  components/                # Logo, header, footer, ExerciseFigure, YouTubeFacade, charts…
  data/                      # AUTO-GENERATED program + guidebook JSON (see below)
  lib/                       # typed data accessors + movement archetype classifier
public/                      # logo.svg, icon.svg
```

## Regenerating the data

The files in `src/data/` are generated from the source Markdown by `scripts/parse_data.py` (included). If the source program changes, re-run:

```bash
python3 scripts/parse_data.py
```

It rebuilds `beginner.ts`, `intermediate.ts`, `exerciseLibrary.ts`, `guidebook.ts`, and `appendix.ts`. The parser is idempotent.

---

## Deploying to scorefit.net (Vercel — recommended)

Vercel is the first-party Next.js platform: zero-config App Router builds, automatic SSL, global CDN.

### 1. Push to GitHub
```bash
git init && git add -A && git commit -m "ScoreFit initial"
git branch -M main
git remote add origin https://github.com/<you>/scorefit.git
git push -u origin main
```

### 2. Import on Vercel
- Go to vercel.com → **Add New… → Project** → import the repo.
- Framework preset auto-detects **Next.js**. Build command `next build`, output handled automatically. Click **Deploy**.

> **Database migrations:** apply with `drizzle-kit migrate` (journal-tracked, ordered) — **not** `db:push` (which diffs live schema and risks drift). The `.github/workflows/migrate.yml` workflow runs `npm run db:migrate` on every merge to `main` when the `DATABASE_URL` repo secret is set; run it before/with the Vercel deploy. Locally: `npm run db:migrate`.
>
> **Required production env:** `DATABASE_URL`, `AUTH_SECRET`, and `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (rate limiting is **mandatory in prod** — the server refuses to boot without Upstash). Recommended: `SMTP_*` (transactional email), `CRON_SECRET` (scheduled jobs), `SENTRY_DSN` (error reporting; `npm i @sentry/nextjs` to activate forwarding).

### 3. Add the domain
- Project → **Settings → Domains** → add `scorefit.net` and `www.scorefit.net`.

### 4. Point DNS at your registrar
Add these records (delete any conflicting old A records on the apex first):

| Type | Name | Value |
|---|---|---|
| A | `@` (apex `scorefit.net`) | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns-0.com` |

If you have `CAA` records, add `0 issue "letsencrypt.org"` so the certificate can be issued.

*Alternative:* delegate nameservers to Vercel (`ns1.vercel-dns.com` / `ns2.vercel-dns.com`) — required only if you want wildcard subdomains.

### 5. Verify
- DNS usually propagates in minutes (up to a couple of hours). Vercel auto-provisions and renews SSL.
- Confirm with: `vercel domains inspect scorefit.net` (Vercel CLI) or just load https://scorefit.net.

### Alternatives
- **Netlify**: works via the Netlify Next.js Runtime. Apex → A `75.2.60.5` (or ALIAS/ANAME to `apex-loadbalancer.netlify.com`); `www` CNAME to `<site>.netlify.app`.
- **Cloudflare**: use the OpenNext Cloudflare adapter (`@opennextjs/cloudflare`) with `nodejs_compat` enabled. The edge runtime is not supported.

---

## Notes & honest limitations

- **Exercise imagery uses the demo-video stills** (real people, the exact movement), shown as click-to-play previews. To use your own images instead, drop a file at `public/exercises/<exercise-slug>.jpg` (or .webp/.png) — it's picked up automatically, no code changes. Slugs match the URLs (e.g. `bayesian-cable-curl.jpg`).
- **Demo videos** load on click (privacy-friendly `youtube-nocookie`, no player JS until the user opts in).
- **Not medical advice.** The site includes a standard disclaimer; keep it.
- Content is parsed from the source program document. Verify a few prescriptions against the original before publishing if accuracy is critical.
```
