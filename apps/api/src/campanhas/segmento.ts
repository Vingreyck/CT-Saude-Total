import { prisma, type Prisma } from '@ct/db'

/**
 * Quem recebe a campanha (CT-030).
 *
 * Duas regras valem para TODO segmento, sem exceção e sem opção de desligar:
 *
 * 1. **Só quem tem celular válido.** Telefone ruim gasta template pago e volta
 *    erro.
 * 2. **Nunca quem está em opt-out.** A checagem é feita no banco, não no
 *    fluxo, e é repetida na hora do envio, porque a pessoa pode ter pedido
 *    para sair entre montar o lote e disparar.
 */

export type NomeSegmento =
  | 'ativos'
  | 'inativos'
  | 'cancelados'
  | 'prospects'
  | 'aniversariantes'
  | 'ausentes'

export const SEGMENTOS: Array<{ nome: NomeSegmento; rotulo: string; descricao: string }> = [
  { nome: 'ativos', rotulo: 'Alunos ativos', descricao: 'Contrato vigente. O público da pesquisa' },
  { nome: 'inativos', rotulo: 'Inativos', descricao: 'Sem contrato vigente, mas não cancelaram' },
  { nome: 'cancelados', rotulo: 'Cancelados', descricao: 'Para campanha de retorno' },
  { nome: 'prospects', rotulo: 'Visitaram e não fecharam', descricao: 'Leads do EVO' },
  { nome: 'aniversariantes', rotulo: 'Aniversariantes de hoje', descricao: 'Recalculado a cada dia' },
  { nome: 'ausentes', rotulo: 'Sumiram há 3 dias', descricao: 'Sem passar na catraca. Depende do CT-016' },
]

/** Base obrigatória. Nada nem ninguém monta um lote sem isto. */
function filtroObrigatorio(): Prisma.MembroWhereInput {
  return {
    telefoneValido: true,
    telefoneE164: { not: null },
    // O opt-out mora em tabela separada, entao a exclusao e por ausencia de
    // registro. `none` garante que ninguem com OPT_OUT entra no lote.
    consentimentos: { none: { status: 'OPT_OUT', canal: 'WHATSAPP' } },
  }
}

export function montarFiltro(segmento: NomeSegmento): Prisma.MembroWhereInput {
  const base = filtroObrigatorio()

  switch (segmento) {
    case 'ativos':
      return { ...base, status: 'ATIVO' }

    case 'inativos':
      return { ...base, status: 'INATIVO' }

    case 'cancelados':
      return { ...base, status: 'CANCELADO' }

    case 'prospects':
      return { ...base, status: 'PROSPECT' }

    case 'aniversariantes': {
      // Prisma nao compara mes e dia direto, entao o recorte fino fica no
      // codigo. Este filtro so reduz o conjunto; quem decide e filtrarPorData.
      return { ...base, status: 'ATIVO', nascimento: { not: null } }
    }

    case 'ausentes':
      return { ...base, status: 'ATIVO' }
  }
}

/** O recorte que o banco não faz: aniversário de hoje e ausência real. */
export async function selecionar(
  segmento: NomeSegmento,
  opcoes: { diasSemIr?: number } = {},
): Promise<Array<{ id: string; nome: string; telefoneE164: string }>> {
  const candidatos = await prisma.membro.findMany({
    where: montarFiltro(segmento),
    select: { id: true, nome: true, telefoneE164: true, nascimento: true },
  })

  let lista = candidatos.filter(
    (m): m is typeof m & { telefoneE164: string } => !!m.telefoneE164,
  )

  if (segmento === 'aniversariantes') {
    const hoje = new Date()
    lista = lista.filter(
      (m) =>
        m.nascimento &&
        m.nascimento.getUTCMonth() === hoje.getMonth() &&
        m.nascimento.getUTCDate() === hoje.getDate(),
    )
  }

  if (segmento === 'ausentes') {
    const dias = opcoes.diasSemIr ?? 3
    const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)

    const passaram = await prisma.checkin.findMany({
      where: { dataHora: { gte: limite } },
      select: { membroId: true },
      distinct: ['membroId'],
    })
    const quemFoi = new Set(passaram.map((c) => c.membroId))
    lista = lista.filter((m) => !quemFoi.has(m.id))
  }

  return lista.map(({ id, nome, telefoneE164 }) => ({ id, nome, telefoneE164 }))
}

/**
 * Quanto a campanha vai custar, antes de apertar o botão.
 *
 * Números de setembro de 2026. A partir de 01/10 a Meta passa a cobrar as
 * mensagens de serviço dentro da janela de 24h, com 1.000 grátis por mês e
 * US$ 0,006 depois, então a conversa deixou de ser de graça.
 */
export interface Custo {
  pessoas: number
  template: number
  conversa: number
  total: number
  premissa: string
}

const CUSTO_MARKETING = 0.34
const CUSTO_UTILITY = 0.04
const CUSTO_SERVICO = 0.03
const MENSAGENS_POR_CONVERSA = 6
const TAXA_RESPOSTA = 0.4
const SERVICO_GRATIS_MES = 1000

export function estimarCusto(pessoas: number, categoria: 'marketing' | 'utility'): Custo {
  const porTemplate = categoria === 'marketing' ? CUSTO_MARKETING : CUSTO_UTILITY
  const template = pessoas * porTemplate

  const respondem = Math.round(pessoas * TAXA_RESPOSTA)
  const mensagens = respondem * MENSAGENS_POR_CONVERSA
  const cobradas = Math.max(0, mensagens - SERVICO_GRATIS_MES)
  const conversa = cobradas * CUSTO_SERVICO

  return {
    pessoas,
    template: Number(template.toFixed(2)),
    conversa: Number(conversa.toFixed(2)),
    total: Number((template + conversa).toFixed(2)),
    premissa: `${Math.round(TAXA_RESPOSTA * 100)}% respondendo, ${MENSAGENS_POR_CONVERSA} mensagens por conversa, ${SERVICO_GRATIS_MES} de serviço grátis no mês`,
  }
}
