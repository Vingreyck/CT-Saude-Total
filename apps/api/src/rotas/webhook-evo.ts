import type { FastifyInstance } from 'fastify'

/**
 * Webhook do EVO (CT-015).
 *
 * Responde 200 rapido e enfileira. Provedor de webhook que espera processamento
 * faz retry e gera evento duplicado.
 */
export async function rotasWebhookEvo(app: FastifyInstance) {
  app.post('/evo', async (req, reply) => {
    app.log.info({ payload: req.body }, 'webhook evo recebido')
    // TODO CT-015: validar assinatura e enfileirar job de aplicar evento
    return reply.code(200).send({ recebido: true })
  })
}
