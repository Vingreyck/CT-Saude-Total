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
  token?: string
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
  private token: string
  private tentativas: number
  private timeoutMs: number

  constructor(o: OpcoesEvo = {}) {
    this.baseUrl = o.baseUrl ?? process.env.EVO_BASE_URL ?? 'https://evo-integracao.w12app.com.br'
    this.token = o.token ?? process.env.EVO_TOKEN ?? ''
    this.tentativas = o.tentativas ?? 4
    this.timeoutMs = o.timeoutMs ?? 30_000

    if (!this.token) {
      throw new Error('EVO_TOKEN vazio. Gere em Configuracoes > Integracoes > Tokens no painel do EVO.')
    }
  }

  private async get<T>(caminho: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(caminho, this.baseUrl)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))

    let ultimoErro: Error | null = null

    for (let tentativa = 1; tentativa <= this.tentativas; tentativa++) {
      try {
        const r = await fetch(url, {
          headers: { Authorization: `Basic ${this.token}`, Accept: 'application/json' },
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

  /**
   * Pagina a base inteira de membros. O EVO devolve em lotes, entao isso e um
   * gerador: quem consome grava lote a lote em vez de segurar 3 mil alunos na
   * memoria e perder tudo se cair no meio.
   */
  async *listarMembros(tamanhoLote = 50): AsyncGenerator<EvoMembro[]> {
    let skip = 0
    while (true) {
      const lote = await this.get<EvoMembro[]>('/api/v1/members', { take: tamanhoLote, skip })
      if (!lote.length) return
      yield lote
      if (lote.length < tamanhoLote) return
      skip += tamanhoLote
    }
  }

  async obterMembro(idMember: number): Promise<EvoMembro> {
    return this.get<EvoMembro>(`/api/v1/members/${idMember}`)
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
      await this.get('/api/v1/members', { take: 1, skip: 0 })
      return { ok: true, detalhe: 'token valido e API respondendo' }
    } catch (e) {
      const erro = e as EvoError
      return {
        ok: false,
        detalhe:
          erro.status === 401
            ? 'token invalido ou sem permissao'
            : erro.status === 403
              ? 'plano da academia pode nao liberar API. Ver docs/01-arquitetura.md secao 7.1'
              : erro.message,
      }
    }
  }
}
