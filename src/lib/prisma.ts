import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient
}

// Sanitize DATABASE_URL: remove surrounding quotes if present
const rawDbUrl = process.env.DATABASE_URL ?? '';
const dbUrl = rawDbUrl.startsWith('"') && rawDbUrl.endsWith('"')
  ? rawDbUrl.slice(1, -1)
  : rawDbUrl;

// Initialize Prisma client with sanitized URL
export const prisma = global.prisma || new PrismaClient({
  datasources: { db: { url: dbUrl } }
})

if (process.env.NODE_ENV !== 'production') global.prisma = prisma
