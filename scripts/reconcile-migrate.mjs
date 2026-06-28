// One-off drift reconciler. The prod journal (drizzle.__drizzle_migrations) is BEHIND
// the actual schema — some pending migrations' objects already exist (a past `db:push`),
// so drizzle-kit migrate hits "already exists", rolls back, and applies nothing.
//
// This walks each pending migration (by the journal's `when` timestamp), runs its
// statements one at a time, SKIPS only "already exists" errors (aborts on anything else),
// and then records the migration in the journal using the SAME sha256(file) hash + `when`
// that drizzle uses — so afterward `npm run db:migrate` sees a clean, consistent state.
// Purely additive: it never drops anything. Resumable: re-running picks up where it left.
//
//   node --env-file=.env.local scripts/reconcile-migrate.mjs
//
// Point .env.local's DATABASE_URL at the prod DIRECT (non-pooler) host.
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set. Run: node --env-file=.env.local scripts/reconcile-migrate.mjs");
  process.exit(1);
}
console.log("→ target host:", new URL(url).host);

// Errors that mean "this object is already there" — safe to skip for additive DDL.
const IGNORABLE = new Set([
  "42701", // duplicate_column
  "42P07", // duplicate_table / relation (incl. indexes)
  "42710", // duplicate_object (constraint, type/enum, etc.)
  "42P06", // duplicate_schema
]);

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));

try {
  const [{ m }] = await sql`select coalesce(max(created_at), 0)::bigint as m from drizzle.__drizzle_migrations`;
  const lastApplied = Number(m);
  console.log("→ last applied migration timestamp:", lastApplied);

  const pending = journal.entries.filter((e) => e.when > lastApplied).sort((a, b) => a.when - b.when);
  if (pending.length === 0) {
    console.log("✅ nothing pending — journal already current.");
  }

  for (const entry of pending) {
    const content = readFileSync(`drizzle/${entry.tag}.sql`, "utf8");
    const statements = content.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
    console.log(`\n=== ${entry.tag} (${statements.length} statements) ===`);
    let applied = 0;
    let skipped = 0;
    for (const stmt of statements) {
      const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
      try {
        await sql.unsafe(stmt);
        applied++;
        console.log("  ok   :", preview);
      } catch (e) {
        if (IGNORABLE.has(e.code)) {
          skipped++;
          console.log(`  skip : [${e.code}] ${preview}`);
        } else {
          console.error(`\n❌ FATAL [${e.code}] ${e.message}\n   in statement:\n${stmt}\n`);
          await sql.end();
          process.exit(1);
        }
      }
    }
    // Record it the way drizzle does: sha256 of the raw file + the journal's `when`.
    const hash = createHash("sha256").update(content).digest("hex");
    await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${entry.when})`;
    console.log(`  ✓ journaled ${entry.tag}  (applied ${applied}, skipped ${skipped})`);
  }

  console.log("\n✅ reconciliation complete — journal and schema are now consistent.");
} catch (e) {
  console.error("❌ unexpected error:\n", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
