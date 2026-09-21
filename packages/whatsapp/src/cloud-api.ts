import crypto from 'node:crypto'
import type {
  CanalWhatsapp,
  EnvioTemplate,
  EnvioTexto,
  EventoStatus,
  MensagemRecebida,
  ResultadoEnvio,
  TipoConteudo,
} from './canal.js'

/**
 * Driver oficial: WhatsApp Cloud API da Meta.
 *
 * Escolhido para producao porque o produto inteiro depende do numero da
 * academia continuar vivo. A rota nao oficial economiza alguns reais por
 * campanha e cobra isso de volta com banimento permanente. Ver
 * docs/01-arquitetura.md secao 6.
 */

const API = 'https://graph.facebook.com/v21.0'

export class CloudApiWhatsapp implements CanalWhatsapp {
  constructor(
    private phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    private accessToken = process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    private appSecret = process.env.WHATSAPP_APP_SECRET ?? '',
  ) {}

  private async post(corpo: unknown): Promise<ResultadoEnvio> {
    try {
      const r = await fetch(`${API}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(corpo),
      })

      const json = (await r.json()) as {
        messages?: Array<{ id: string }>
        error?: { message: string; code: number }
      }

      if (!r.ok) {
        return {
          ok: false,
          erro: json.error?.message ?? `HTTP ${r.status}`,
          // 429 e 5xx passam, o resto e erro nosso e reenviar nao resolve.
          reentar: r.status === 429 || r.status >= 500,
        }
      }

      return { ok: true, providerMessageId: json.messages?.[0]?.id }
    } catch (e) {
      return { ok: false, erro: (e as Error).message, reentar: true }
    }
  }

  async enviarTemplate(p: EnvioTemplate): Promise<ResultadoEnvio> {
    return this.post({
      messaging_product: 'whatsapp',
      to: p.paraE164.replace('+', ''),
      type: 'template',
      template: {
        name: p.template,
        language: { code: p.idioma ?? 'pt_BR' },
        components: p.variaveis?.length
          ? [
              {
                type: 'body',
                parameters: p.variaveis.map((text) => ({ type: 'text', text })),
              },
            ]
          : undefined,
      },
    })
  }

  async enviarTexto(p: EnvioTexto): Promise<ResultadoEnvio> {
    return this.post({
      messaging_product: 'whatsapp',
      to: p.paraE164.replace('+', ''),
      type: 'text',
      text: { body: p.texto, preview_url: false },
    })
  }

  async marcarDigitando(_paraE164: string): Promise<void> {
    // A Cloud API expoe "digitando" junto com a marcacao de lida, que precisa
    // do id da mensagem recebida. Quem tem esse id e a camada de conversa, e e
    // la que a chamada acontece. Aqui fica o no-op para o contrato bater.
  }

  validarAssinatura(corpoBruto: string, assinatura: string | undefined): boolean {
    if (!assinatura || !this.appSecret) return false

    const esperado =
      'sha256=' + crypto.createHmac('sha256', this.appSecret).update(corpoBruto, 'utf8').digest('hex')

    const a = Buffer.from(assinatura)
    const b = Buffer.from(esperado)
    // Comparacao em tempo constante. Comparar com === vaza o segredo por tempo.
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  }

  interpretarWebhook(payload: unknown): {
    mensagens: MensagemRecebida[]
    statuses: EventoStatus[]
  } {
    const mensagens: MensagemRecebida[] = []
    const statuses: EventoStatus[] = []

    const p = payload as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<Record<string, any>>
            statuses?: Array<Record<string, any>>
          }
        }>
      }>
    }

    for (const entry of p.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const m of change.value?.messages ?? []) {
          mensagens.push({
            deE164: `+${m.from}`,
            providerMessageId: m.id,
            tipo: mapearTipo(m.type),
            texto: m.text?.body ?? m.button?.text ?? m.interactive?.list_reply?.title,
            midiaUrl: m.audio?.id ?? m.image?.id ?? m.document?.id,
            recebidaEm: new Date(Number(m.timestamp) * 1000),
          })
        }

        for (const s of change.value?.statuses ?? []) {
          statuses.push({
            providerMessageId: s.id,
            status: mapearStatus(s.status),
            erro: s.errors?.[0]?.title,
            em: new Date(Number(s.timestamp) * 1000),
          })
        }
      }
    }

    return { mensagens, statuses }
  }
}

function mapearTipo(t: string): TipoConteudo {
  switch (t) {
    case 'audio':
      return 'audio'
    case 'image':
      return 'imagem'
    case 'document':
      return 'documento'
    case 'interactive':
    case 'button':
      return 'interativo'
    default:
      return 'texto'
  }
}

function mapearStatus(s: string): EventoStatus['status'] {
  switch (s) {
    case 'delivered':
      return 'entregue'
    case 'read':
      return 'lido'
    case 'failed':
      return 'falhou'
    default:
      return 'enviado'
  }
}
