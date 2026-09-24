import type { FastifyInstance, FastifyRequest } from 'fastify'
import { criarCanal } from '@ct/whatsapp'
import { env } from '../env.js'
import { botRespondendo, receberMensagem, registrarStatus } from '../conversas/receber.js'
import { responderComBot } from '../conversas/responder.js'

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
        const r = await receberMensagem(m)

        if (!r.novo) {
          // Reenvio da Meta. Ja estava gravada, entao nao ha o que fazer.
          app.log.debug({ id: m.providerMessageId }, 'webhook repetido, ignorado')
          continue
        }

        app.log.info(
          {
            de: r.quem,
            tipo: m.tipo,
            membro: !!r.membroId,
            triagem: r.triagem,
            bot: botRespondendo() ? 'ligado' : 'desligado',
          },
          'mensagem recebida',
        )

        if (!botRespondendo()) continue

        // O bot so entra aqui quando BOT_RESPONDE=sim. Enquanto isso, a
        // mensagem fica gravada e aparece na caixa de entrada para a equipe.
        await responderComBot(r, m.texto ?? '')
      }

      for (const s of statuses) {
        const achou = await registrarStatus(s.providerMessageId, s.status, s.erro)
        if (!achou) {
          app.log.debug({ id: s.providerMessageId }, 'status de mensagem que nao e nossa')
        }
      }
    } catch (e) {
      // Erro aqui nunca pode virar 500, senao a Meta reenvia e duplica.
      app.log.error({ err: e }, 'falha ao processar webhook whatsapp')
    }
  })
}
