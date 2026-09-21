/**
 * Tipos da EVO API.
 *
 * Marcados como parciais de proposito: estes campos foram inferidos do Swagger
 * publico (evo-integracao.w12app.com.br/swagger). Na CT-010, com token real em
 * maos, rode uma chamada, salve o JSON e ajuste isto aqui com o retorno de
 * verdade antes de escrever o sync. Nao confie neste arquivo como contrato.
 */

export interface EvoMembro {
  idMember: number
  firstName?: string
  lastName?: string
  name?: string
  document?: string
  email?: string
  cellphone?: string
  phone?: string
  birthDate?: string
  registerDate?: string
  status?: string
  membershipStatus?: string
  idBranch?: number
  contracts?: Array<{
    idMembership?: number
    name?: string
    startDate?: string
    endDate?: string
    status?: string
  }>
}

export interface EvoProspect {
  idProspect: number
  name?: string
  email?: string
  cellphone?: string
  registerDate?: string
  status?: string
}

export interface EvoEntrada {
  idEntry?: number
  idMember?: number
  date?: string
  direction?: string
  idBranch?: number
}

/** Mapeia o status do EVO para o nosso enum. Regra fica num lugar so. */
export function mapearStatus(evo: string | undefined): 'ATIVO' | 'INATIVO' | 'CANCELADO' | 'PROSPECT' {
  const s = (evo ?? '').toLowerCase()
  if (s.includes('ativ')) return 'ATIVO'
  if (s.includes('cancel')) return 'CANCELADO'
  if (s.includes('prospect')) return 'PROSPECT'
  return 'INATIVO'
}

/** O EVO devolve nome em campos diferentes dependendo do endpoint. */
export function nomeDoMembro(m: EvoMembro): string {
  return m.name ?? [m.firstName, m.lastName].filter(Boolean).join(' ') ?? 'Aluno'
}

/** Celular primeiro: fixo nao recebe WhatsApp. */
export function telefoneDoMembro(m: EvoMembro): string | null {
  return m.cellphone ?? m.phone ?? null
}
