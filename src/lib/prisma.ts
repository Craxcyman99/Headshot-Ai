import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  const pool = new Pool({
    connectionString,
    max: 1,                       // Serverless: one connection per instance
    idleTimeoutMillis: 20_000,    // Close idle connections after 20s
    connectionTimeoutMillis: 5_000, // Fail fast on connection timeout
    ssl: { rejectUnauthorized: false }, // Required for Supabase pooler
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
