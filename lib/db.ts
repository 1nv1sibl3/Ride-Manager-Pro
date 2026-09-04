import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Normalizes DATABASE_URL so the same env var works against local Postgres,
// hosted Postgres (Azure/RDS/…), and Supabase's Supavisor pooler:
// - Pooler (transaction mode: port 6543 or a "pooler" hostname) →
//   pgbouncer=true is required (prepared statements must be disabled behind
//   transaction pooling) and the pool is capped at a single connection.
// - Direct connections → a small pool is plenty for a shop tool.
// - TLS → required for remote hosts, untouched for localhost.
// Params already present in the URL are never overridden.
function normalizeDbUrl(url: string): string {
  try {
    const u = new URL(url);
    const isLocal = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(u.hostname);
    const isPooler = u.port === "6543" || u.hostname.includes("pooler");
    if (isPooler) {
      if (!u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
      if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "1");
    } else {
      if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "3");
      if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "20");
    }
    if (!isLocal && !u.searchParams.has("sslmode")) u.searchParams.set("sslmode", "require");
    return u.toString();
  } catch {
    return url;
  }
}

function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }
  const client = new PrismaClient({
    log: ["warn", "error"],
    datasources: { db: { url: normalizeDbUrl(process.env.DATABASE_URL) } },
  });
  globalForPrisma.prisma = client;
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    return (client as any)[prop];
  },
});
