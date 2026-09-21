/**
 * Interface unica de canal de WhatsApp (CT-021).
 *
 * O canal e a peca mais volatil do projeto: custo muda, politica da Meta muda,
 * e existe risco de ban no caminho nao oficial. Tudo fica atras desta interface
 * para que trocar de provedor seja trocar de implementacao, e nao reescrever o
 * motor de campanha inteiro.
 *
 * Producao usa o driver oficial (Cloud API da Meta). O driver Evolution existe
 * so para desenvolvimento, com numero descartavel.
 */

export interface EnvioTemplate {
  paraE164: string
  template: string
  idioma?: string
  /** Variaveis na ordem em que aparecem no template aprovado. */
  variaveis?: string[]
}

export interface EnvioTexto {
  paraE164: string
  texto: string
}

export interface ResultadoEnvio {
  ok: boolean
  providerMessageId?: string
  erro?: string
  /** true quando o erro e temporario e vale reenfileirar (429, 5xx, rede). */
  reentar?: boolean
}

export type TipoConteudo = 'texto' | 'audio' | 'imagem' | 'documento' | 'interativo'

/** Formato unico para o qual todo webhook, de qualquer driver, e normalizado. */
export interface MensagemRecebida {
  deE164: string
  providerMessageId: string
  tipo: TipoConteudo
  texto?: string
  midiaUrl?: string
  recebidaEm: Date
}

export interface EventoStatus {
  providerMessageId: string
  status: 'enviado' | 'entregue' | 'lido' | 'falhou'
  erro?: string
  em: Date
}

export interface CanalWhatsapp {
  /** Abre conversa fora da janela de 24h. Mensagem PAGA. */
  enviarTemplate(p: EnvioTemplate): Promise<ResultadoEnvio>

  /** So funciona dentro da janela de 24h. Mensagem GRATUITA. */
  enviarTexto(p: EnvioTexto): Promise<ResultadoEnvio>

  /** Indicador de "digitando", usado junto com o atraso humano (CT-044). */
  marcarDigitando(paraE164: string): Promise<void>

  /** Confirma que a requisicao veio mesmo do provedor, e nao de um terceiro. */
  validarAssinatura(corpoBruto: string, assinatura: string | undefined): boolean

  /** Traduz o payload do provedor para o formato unico acima. */
  interpretarWebhook(payload: unknown): {
    mensagens: MensagemRecebida[]
    statuses: EventoStatus[]
  }
}
