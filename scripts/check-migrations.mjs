// Migration pre-flight: before applying migrations to a database, assert that every
// PENDING migration (those newer than what the DB has recorded) is ADDITIVE — i.e. it
// contains no destructive DDL (DROP TABLE / DROP COLUMN / DROP CONSTRAINT / TRUNCATE).
// Destructive changes shouldn't reach prod without a human ack, so this aborts on them.
//
//   node --env-file=.env.local scripts/check-migrations.mjs
//   (deploy pipeline runs it against the prod DATABASE_URL before db:migrate)
//
// Set ALLOW_DESTRUCTIVE=true to bypass intentionally (a reviewed destructive migration).
import postgres from "postgres";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set.");
  process.exit(1);
}

const DESTRUCTIVE = /\b(drop\s+table|drop\s+column|drop\s+constraint|truncate)\b/i;

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));

try {
  let lastApplied = 0;
  try {
    const [{ m }] = await sql`select coalesce(max(created_at), 0)::bigint as m from drizzle.__drizzle_migrations`;
    lastApplied = Number(m);
  } catch {
    // No journal table yet (fresh DB) → everything is "pending"; a fresh DB has nothing to
    // destroy, so that's fine.
  }

  const pending = journal.entries.filter((e) => e.when > lastApplied).sort((a, b) => a.when - b.when);
  console.log(`→ ${pending.length} pending migration(s): ${pending.map((p) => p.tag).join(", ") || "none"}`);

  const offenders = [];
  for (const entry of pending) {
    const content = readFileSync(`drizzle/${entry.tag}.sql`, "utf8");
    for (const stmt of content.split("--> statement-breakpoint")) {
      if (DESTRUCTIVE.test(stmt)) offenders.push({ tag: entry.tag, stmt: stmt.trim().replace(/\s+/g, " ").slice(0, 120) });
    }
  }

  if (offenders.length && process.env.ALLOW_DESTRUCTIVE !== "true") {
    console.error("\n❌ Destructive DDL found in pending migrations (set ALLOW_DESTRUCTIVE=true to override):");
    for (const o of offenders) console.error(`   [${o.tag}] ${o.stmt}`);
    process.exit(1);
  }
  console.log(offenders.length ? "⚠ destructive DDL present but ALLOW_DESTRUCTIVE=true — proceeding." : "✅ pre-flight passed: all pending migrations are additive.");
} catch (e) {
  console.error("pre-flight error:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
