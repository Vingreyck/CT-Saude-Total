import Fastify from 'fastify'
import { env } from './env.js'
import { rotasSaude } from './rotas/saude.js'
import { rotasWebhookWhatsapp } from './rotas/webhook-whatsapp.js'
import { rotasWebhookEvo } from './rotas/webhook-evo.js'
import { rotasLaboratorio } from './rotas/laboratorio.js'
import { rotasConversas } from './rotas/conversas.js'
import cors from '@fastify/cors'

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    // correlationId por requisicao. Disparo em massa sem log rastreavel e
    // impossivel de investigar quando alguem reclama que recebeu duas vezes.
    redact: ['req.headers.authorization', 'req.headers["x-hub-signature-256"]'],
  },
  trustProxy: true,
})

/**
 * O webhook da Meta assina o corpo BRUTO. Se o Fastify fizer o parse antes de
 * guardarmos o texto original, a assinatura nunca bate e todo webhook e
 * recusado. Por isso o corpo cru fica preso na request.
 */
app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, corpo, done) => {
  ;(req as { corpoBruto?: string }).corpoBruto = corpo as string
  try {
    done(null, JSON.parse(corpo as string))
  } catch (e) {
    done(e as Error, undefined)
  }
})

// O painel roda em outro dominio, entao precisa de CORS para falar com a api.
await app.register(cors, { origin: true })

await app.register(rotasSaude)
await app.register(rotasWebhookWhatsapp, { prefix: '/webhooks' })
await app.register(rotasWebhookEvo, { prefix: '/webhooks' })
await app.register(rotasLaboratorio, { prefix: '/lab' })
await app.register(rotasConversas, { prefix: '/conversas' })

const encerrar = async (sinal: string) => {
  app.log.info({ sinal }, 'encerrando')
  await app.close()
  process.exit(0)
}
process.on('SIGTERM', () => void encerrar('SIGTERM'))
process.on('SIGINT', () => void encerrar('SIGINT'))

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
} catch (e) {
  app.log.error(e)
  process.exit(1)
}
