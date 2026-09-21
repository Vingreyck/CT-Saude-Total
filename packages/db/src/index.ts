import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

/**
 * Cliente unico. Em dev o hot reload recarrega o modulo varias vezes, e sem
 * esse cache o Postgres estoura o limite de conexoes em poucos minutos.
 */
export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma

export * from '@prisma/client'
