import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// prepare:false keeps us compatible with Neon's pooled (PgBouncer) endpoint,
// which runs in transaction mode and does not support prepared statements.
// Reuse the client across hot-reloads / serverless invocations.
const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };
const sql = globalForDb.sql ?? postgres(connectionString, { prepare: false, max: 5 });
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
