import type { EvoMembro, EvoEntrada, EvoProspect } from './tipos.js'

/**
 * Client da EVO API (CT-011).
 *
 * Base e token: Configuracoes > Integracoes > aba Tokens, dentro do painel da
 * academia. A aba Consumo mostra o limite de requisicoes por mes.
 *
 * ATENCAO: o limite exato do plano da academia ainda nao foi confirmado
 * (CT-010, bloqueante). Enquanto isso, o backoff abaixo assume que 429 pode
 * acontecer a qualquer momento e trata como normal, nao como erro.
 */

export interface OpcoesEvo {
  baseUrl?: string
  /** DNS da academia no EVO. E o usuario do Basic Auth. */
  dns?: string
  /** Chave aleatoria gerada junto com o token. E a senha do Basic Auth. */
  chave?: string
  /** Tentativas por requisicao antes de desistir. */
  tentativas?: number
  timeoutMs?: number
}

export class EvoError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string,
  ) {
    super(message)
    this.name = 'EvoError'
  }
}

export class EvoClient {
  private baseUrl: string
  private autorizacao: string
  private tentativas: number
  private timeoutMs: number

  constructor(o: OpcoesEvo = {}) {
    this.baseUrl = o.baseUrl ?? process.env.EVO_BASE_URL ?? 'https://evo-integracao.w12app.com.br'
    this.tentativas = o.tentativas ?? 4
    this.timeoutMs = o.timeoutMs ?? 30_000

    const dns = o.dns ?? process.env.EVO_DNS ?? ''
    const chave = o.chave ?? process.env.EVO_TOKEN ?? ''

    if (!dns || !chave) {
      throw new Error(
        'EVO_DNS ou EVO_TOKEN vazio. No painel do EVO: engrenagem > Integracao > botao +. ' +
          'O DNS da academia e o usuario, a chave gerada e a senha.',
      )
    }

    // Basic Auth = base64 de "usuario:senha". O EVO usa o DNS como usuario e a
    // chave como senha. Montar aqui evita o erro classico de colar a chave crua
    // no header e tomar 401 sem entender por que.
    this.autorizacao = 'Basic ' + Buffer.from(`${dns}:${chave}`).toString('base64')
  }

  private async get<T>(caminho: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(caminho, this.baseUrl)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))

    let ultimoErro: Error | null = null

    for (let tentativa = 1; tentativa <= this.tentativas; tentativa++) {
      try {
        const r = await fetch(url, {
          headers: { Authorization: this.autorizacao, Accept: 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs),
        })

        if (r.status === 429 || r.status >= 500) {
          // Backoff exponencial com teto. Rate limit do EVO nao e erro nosso,
          // e ritmo. Estourar o limite derruba o sync inteiro do dia.
          const espera = Math.min(30_000, 2 ** tentativa * 500)
          await new Promise((res) => setTimeout(res, espera))
          ultimoErro = new EvoError(`HTTP ${r.status}`, r.status, caminho)
          continue
        }

        if (!r.ok) {
          throw new EvoError(`HTTP ${r.status}: ${await r.text()}`, r.status, caminho)
        }

        return (await r.json()) as T
      } catch (e) {
        if (e instanceof EvoError && e.status < 500 && e.status !== 429) throw e
        ultimoErro = e as Error
      }
    }

    throw ultimoErro ?? new EvoError('falhou sem erro registrado', 0, caminho)
  }

  /** Le o cabecalho `total` da resposta, que diz o tamanho da base. */
  private async head(caminho: string, params: Record<string, string | number> = {}): Promise<number> {
    const url = new URL(caminho, this.baseUrl)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
    const r = await fetch(url, {
      headers: { Authorization: this.autorizacao, Accept: 'application/json' },
      signal: AbortSignal.timeout(this.timeoutMs),
    })
    if (!r.ok) throw new EvoError(`HTTP ${r.status}`, r.status, caminho)
    return Number(r.headers.get('total') ?? 0)
  }

  /**
   * Lista membros.
   *
   * Duas coisas que mudam a conta de cota, descobertas na especificacao da
   * API em 22/09/2026:
   *
   * 1. `take` aceita ate 10.000 por requisicao, nao 50. A base inteira de
   *    3.166 alunos cabe em UMA chamada.
   * 2. `updateDate` traz so quem mudou desde a data informada. O sync diario
   *    vira uma requisicao com pouca coisa dentro, em vez de reler tudo.
   *
   * Com isso o consumo mensal sai de ~1.900 requisicoes para umas 30, bem
   * dentro do limite de 1.000/mes do plano Plus.
   *
   * `showMemberships` e opcional na API e vem desligado. Sem ele nao vem
   * contrato nenhum, e o campo plano fica vazio.
   */
  async *listarMembros(
    opcoes: { desde?: Date; apenasAtivos?: boolean; tamanhoLote?: number } = {},
  ): AsyncGenerator<EvoMembro[]> {
    const { desde, apenasAtivos, tamanhoLote = 1000 } = opcoes
    let skip = 0

    while (true) {
      const params: Record<string, string | number> = {
        take: tamanhoLote,
        skip,
        showMemberships: 'true',
      }
      if (desde) params.updateDate = desde.toISOString().slice(0, 10)
      if (apenasAtivos) params.status = 1

      const lote = await this.get<EvoMembro[]>('/api/v2/members', params)
      if (!lote.length) return
      yield lote
      if (lote.length < tamanhoLote) return
      skip += tamanhoLote
    }
  }

  async obterMembro(idMember: number): Promise<EvoMembro> {
    return this.get<EvoMembro>(`/api/v2/members/${idMember}`, { showMemberships: 'true' })
  }

  /** Quantos membros existem, sem baixar nenhum. Custa 1 requisicao. */
  async contar(): Promise<number> {
    const r = await this.head('/api/v2/members', { take: 1, skip: 0 })
    return r
  }

  async *listarProspects(tamanhoLote = 50): AsyncGenerator<EvoProspect[]> {
    let skip = 0
    while (true) {
      const lote = await this.get<EvoProspect[]>('/api/v1/prospects', { take: tamanhoLote, skip })
      if (!lote.length) return
      yield lote
      if (lote.length < tamanhoLote) return
      skip += tamanhoLote
    }
  }

  /**
   * Entradas na catraca, base do lembrete de ausencia (CT-070).
   *
   * PENDENTE (CT-010): confirmar com o suporte da ABC Evo se o historico vem
   * por consulta ou so por webhook. Se for so webhook, nao existe carga
   * historica dos 90 dias e o epico de retencao muda de forma.
   */
  async listarEntradas(de: Date, ate: Date): Promise<EvoEntrada[]> {
    return this.get<EvoEntrada[]>('/api/v1/entries', {
      dtStart: de.toISOString(),
      dtEnd: ate.toISOString(),
    })
  }

  /** Chamada barata para validar token e conectividade antes de rodar o sync. */
  async testarConexao(): Promise<{ ok: boolean; detalhe: string }> {
    try {
      const total = await this.head('/api/v2/members', { take: 1, skip: 0 })
      return { ok: true, detalhe: `token valido, ${total} membros na base` }
    } catch (e) {
      const erro = e as EvoError
      return {
        ok: false,
        detalhe:
          erro.status === 401
            ? 'DNS ou chave errados, ou o token nao tem a tag de permissao necessaria'
            : erro.status === 403
              ? 'plano da academia pode nao liberar API. Ver docs/01-arquitetura.md secao 7.1'
              : erro.message,
      }
    }
  }
}
