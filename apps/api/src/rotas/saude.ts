import type { FastifyInstance } from 'fastify'
import { prisma } from '@ct/db'

export async function rotasSaude(app: FastifyInstance) {
  /** Healthcheck do Railway. Precisa ser barato e nao tocar em servico externo. */
  app.get('/health', async () => ({ ok: true, em: new Date().toISOString() }))

  /** Checagem profunda, para usar manualmente quando algo parecer errado. */
  app.get('/health/profundo', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return { ok: true, banco: 'conectado' }
    } catch (e) {
      return reply.code(503).send({ ok: false, banco: (e as Error).message })
    }
  })
}
