import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import dns from "node:dns";
import net from "node:net";

// Neon publishes both A (IPv4) and AAAA (IPv6) records. On hosts that have an
// IPv6 address but no working IPv6 route, Node 20+'s "Happy Eyeballs"
// (autoSelectFamily) races the dead AAAA record and hangs until ETIMEDOUT —
// which drizzle-kit swallows, so `db:migrate` silently spins then exits 1 with
// no output. Prefer IPv4 and disable the family race so we connect over IPv4.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
