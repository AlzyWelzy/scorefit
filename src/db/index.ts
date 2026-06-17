import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import dns from "node:dns";
import net from "node:net";
import * as schema from "./schema";

// See drizzle.config.ts: some hosts advertise an unroutable IPv6 address for
// Neon, and Node's Happy Eyeballs then hangs on the dead AAAA record before
// falling back to IPv4. Prefer IPv4. Harmless where IPv6 routes normally.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// prepare:false keeps us compatible with Neon's pooled (PgBouncer) endpoint,
// which runs in transaction mode and does not support prepared statements.
// Reuse the client across hot-reloads / serverless invocations.
const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };
const sql = globalForDb.sql ?? postgres(connectionString, { prepare: false, max: 5 });
// Cache the client across hot-reloads AND serverless invocations so we don't open a
// fresh pool per cold start (connection-exhaustion risk under load).
globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
