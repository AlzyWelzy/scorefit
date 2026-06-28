// Robust migration runner + diagnostics. drizzle-kit's `migrate` CLI swallows errors
// and exits 1 with no message; this uses drizzle-orm's programmatic migrator over the
// same drizzle/ folder + journal, inspects the journal table first, and surfaces the
// real error when one fails.
//
//   node --env-file=.env.local scripts/run-migrate.mjs
//
// Point .env.local's DATABASE_URL at the target DB. Use the DIRECT (non-pooled) Neon
// host for migrations — i.e. WITHOUT `-pooler`.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set. Run: node --env-file=.env.local scripts/run-migrate.mjs");
  process.exit(1);
}

const host = new URL(url).host;
console.log("→ target host:", host);
if (host.includes("-pooler")) console.warn("⚠ POOLED host — use the direct (non-pooler) host for migrations.");

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });

try {
  // Inspect the drizzle journal table — the usual culprit for silent migrate failures.
  const cols = await sql`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
    order by ordinal_position`;
  console.log(
    "→ __drizzle_migrations columns:",
    cols.length ? cols.map((c) => `${c.column_name}:${c.data_type}`).join(", ") : "(table not found)",
  );

  try {
    const rows = await sql`select * from drizzle.__drizzle_migrations order by id`;
    console.log(`→ recorded migrations: ${rows.length}`);
    for (const r of rows) console.log("   ", JSON.stringify(r));
  } catch (e) {
    console.log("→ could not read journal rows:", e.message);
  }
} catch (e) {
  console.log("→ journal inspection error:", e.message);
}

const db = drizzle(sql);
try {
  console.log("→ applying pending migrations…");
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("✅ migrations applied (journal updated).");
} catch (e) {
  console.error("❌ migration failed — real error below:\n", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
