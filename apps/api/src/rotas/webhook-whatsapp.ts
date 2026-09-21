import type { FastifyInstance, FastifyRequest } from 'fastify'
import { criarCanal } from '@ct/whatsapp'
import { env } from '../env.js'

/**
 * Webhook do WhatsApp (CT-022).
 *
 * Duas regras que nao podem ser relaxadas:
 *
 * 1. Assinatura sempre validada. Sem isso, qualquer um na internet injeta
 *    mensagem falsa e faz o bot responder, ou pior, dispara opt-out em massa.
 * 2. Responde 200 em milissegundos e processa depois. A Meta tem timeout curto
 *    e reenvia o que demora, o que gera mensagem duplicada.
 */
export async function rotasWebhookWhatsapp(app: FastifyInstance) {
  const canal = criarCanal()

  // Handshake de verificacao da Meta, feito uma vez ao cadastrar a URL.
  app.get('/whatsapp', async (req, reply) => {
    const q = req.query as Record<string, string>

    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === env.WHATSAPP_VERIFY_TOKEN) {
      return reply.code(200).send(q['hub.challenge'])
    }
    return reply.code(403).send('token de verificacao nao confere')
  })

  app.post('/whatsapp', async (req: FastifyRequest, reply) => {
    const corpoBruto = (req as { corpoBruto?: string }).corpoBruto ?? ''
    const assinatura = req.headers['x-hub-signature-256'] as string | undefined

    if (!canal.validarAssinatura(corpoBruto, assinatura)) {
      app.log.warn({ ip: req.ip }, 'webhook whatsapp com assinatura invalida')
      return reply.code(401).send({ erro: 'assinatura invalida' })
    }

    // Confirma o recebimento antes de qualquer trabalho.
    void reply.code(200).send({ recebido: true })

    try {
      const { mensagens, statuses } = canal.interpretarWebhook(req.body)

      for (const m of mensagens) {
        app.log.info({ de: m.deE164, tipo: m.tipo }, 'mensagem recebida')
        // TODO CT-022/CT-023: gravar mensagem, renovar janela de 24h,
        // checar opt-out e enfileirar o turno do bot.
      }

      for (const s of statuses) {
        app.log.debug({ id: s.providerMessageId, status: s.status }, 'status de entrega')
        // TODO CT-022: gravar evento_entrega e atualizar a mensagem.
      }
    } catch (e) {
      // Erro aqui nunca pode virar 500, senao a Meta reenvia e duplica.
      app.log.error({ err: e }, 'falha ao processar webhook whatsapp')
    }
  })
}
