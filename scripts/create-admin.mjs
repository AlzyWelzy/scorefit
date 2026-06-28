// Django-style "create superuser" for ScoreFit. Promote an existing account to admin by
// email, or create a brand-new verified admin if none exists — no raw SQL needed.
//
//   npm run create-admin -- you@example.com
//   npm run create-admin -- you@example.com --name "Jane" --password 'hunter2longer'
//   npm run create-admin -- old@example.com --revoke      # remove admin
//
// Or directly against an explicit DB (e.g. prod):
//   env DATABASE_URL="postgres://…prod…" node scripts/create-admin.mjs you@example.com
//
// The npm script loads .env.local; it prints the target host before doing anything so you
// can confirm which database you're touching. IDs + password hashing match the real
// signup path (ULID-in-uuid via ulidx, bcrypt cost 12). New admins are created with their
// email already verified so the account is immediately usable.
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { monotonicFactory, ulidToUUID } from "ulidx";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";

const ulid = monotonicFactory();
const newId = () => ulidToUUID(ulid());

// ---- args ----
const argv = process.argv.slice(2);
const flags = { revoke: false, noVerify: false, name: null, password: null };
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--revoke") flags.revoke = true;
  else if (a === "--no-verify") flags.noVerify = true;
  else if (a === "--name") flags.name = argv[++i] ?? null;
  else if (a === "--password") flags.password = argv[++i] ?? null;
  else if (a.startsWith("--")) {
    console.error("Unknown flag:", a);
    process.exit(1);
  } else positional.push(a);
}
const email = (positional[0] ?? "").trim().toLowerCase();
if (!email || !email.includes("@") || !email.includes(".")) {
  console.error(
    "Usage: node scripts/create-admin.mjs <email> [--name <name>] [--password <pw>] [--no-verify] [--revoke]",
  );
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set. Use `npm run create-admin -- <email>` (loads .env.local), or set it explicitly.");
  process.exit(1);
}
console.log("→ target database:", new URL(url).host);

// ---- hidden password prompt (mutes echo, like sudo) ----
function promptHidden(query) {
  return new Promise((resolve) => {
    let muted = false;
    const out = new Writable({
      write(chunk, enc, cb) {
        if (!muted) process.stdout.write(chunk, enc);
        cb();
      },
    });
    const rl = createInterface({ input: process.stdin, output: out, terminal: true });
    process.stdout.write(query);
    muted = true;
    rl.question("", (answer) => {
      muted = false;
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });

async function main() {
  const existing = await sql`select id, is_admin from users where email = ${email} limit 1`;

  if (flags.revoke) {
    if (!existing.length) {
      console.log(`No user with email ${email}.`);
      return;
    }
    await sql`update users set is_admin = false where email = ${email}`;
    console.log(`✓ admin revoked: ${email}`);
    return;
  }

  if (existing.length) {
    // Promote in place. Also verify the email (an admin shouldn't be stuck behind the
    // verify gate) unless --no-verify was passed.
    if (flags.noVerify) {
      await sql`update users set is_admin = true where email = ${email}`;
    } else {
      await sql`update users set is_admin = true, email_verified = coalesce(email_verified, now()) where email = ${email}`;
    }
    console.log(`✓ promoted existing user to admin: ${email} (id ${existing[0].id})`);
    return;
  }

  // Create a new admin account.
  let password = flags.password;
  if (!password) {
    password = await promptHidden("Password (min 8 chars): ");
    const confirm = await promptHidden("Password (again): ");
    if (password !== confirm) {
      console.error("✗ passwords did not match.");
      process.exitCode = 1;
      return;
    }
  }
  if (!password || password.length < 8) {
    console.error("✗ password must be at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = newId();
  const emailVerified = flags.noVerify ? null : new Date();
  await sql`
    insert into users (id, email, password_hash, name, email_verified, is_admin)
    values (${id}, ${email}, ${passwordHash}, ${flags.name}, ${emailVerified}, true)`;
  console.log(`✓ created admin user: ${email} (id ${id})`);
}

try {
  await main();
} catch (e) {
  console.error("✗ failed:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
