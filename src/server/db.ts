import { PrismaClient } from "@prisma/client";

// Sanitize DATABASE_URL: strip surrounding quotes if present
const rawDbUrl = process.env.DATABASE_URL ?? "";
const dbUrl = rawDbUrl.startsWith('"') && rawDbUrl.endsWith('"')
  ? rawDbUrl.slice(1, -1)
  : rawDbUrl;

const createPrismaClient = () =>
  new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log:
      process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
