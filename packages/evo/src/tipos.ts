/**
 * Tipos da EVO API.
 *
 * Estes campos foram confirmados contra a API real do CT Saúde Total em
 * 22/09/2026, não inferidos da documentação. O que estava aqui antes
 * (cellphone, contracts) simplesmente não existe: o telefone mora dentro de
 * `contacts` e o contrato dentro de `memberships`.
 */

/** Um contato do aluno. O telefone fica em `description`, não num campo próprio. */
export interface EvoContato {
  idPhone: number
  idMember: number | null
  idContactType: number
  /** Texto livre vindo do EVO: "Celular", "Email", "Telefone" e afins. */
  contactType: string
  /** Código do país, normalmente "55". */
  ddi: string
  /** O valor em si: o número ou o e-mail. */
  description: string
}

/** Um contrato. Um aluno pode ter vários, inclusive já cancelados. */
export interface EvoMembership {
  idMembership: number
  idMemberMembership: number
  name: string
  startDate: string
  endDate: string | null
  membershipStatus: string
  cancelDate: string | null
  saleDate: string | null
  idCategoryMembership: number | null
}

export interface EvoMembro {
  idMember: number
  firstName?: string
  lastName?: string
  registerName?: string
  registerLastName?: string
  document?: string
  gender?: string
  birthDate?: string
  registerDate?: string
  /** Última passagem na catraca. Base do lembrete de ausência (CT-070). */
  lastAccessDate?: string | null
  status?: string
  membershipStatus?: string
  accessBlocked?: boolean
  blockedReason?: string | null
  idBranch?: number
  branchName?: string
  city?: string
  state?: string
  photoUrl?: string | null
  contacts?: EvoContato[]
  memberships?: EvoMembership[]
}

export interface EvoProspect {
  idProspect: number
  firstName?: string
  lastName?: string
  registerDate?: string
  status?: string
  contacts?: EvoContato[]
}

export interface EvoEntrada {
  idEntry?: number
  idMember?: number
  date?: string
  direction?: string
  idBranch?: number
}

/** O EVO devolve "Active" e "Inactive". Regra fica num lugar só. */
export function mapearStatus(evo: string | undefined): 'ATIVO' | 'INATIVO' | 'CANCELADO' | 'PROSPECT' {
  const s = (evo ?? '').toLowerCase()
  if (s.startsWith('activ') || s.includes('ativ')) return 'ATIVO'
  if (s.includes('cancel')) return 'CANCELADO'
  if (s.includes('prospect')) return 'PROSPECT'
  return 'INATIVO'
}

export function nomeDoMembro(m: EvoMembro): string {
  const partes = [m.firstName ?? m.registerName, m.lastName ?? m.registerLastName]
  const nome = partes.filter(Boolean).join(' ').trim()
  return nome || 'Aluno'
}

/**
 * Acha o celular do aluno dentro de `contacts`.
 *
 * O EVO não separa telefone de e-mail por campo, tudo cai em `description` e o
 * tipo vem como texto livre em `contactType`. Então a estratégia é: tentar
 * primeiro os contatos que dizem ser celular, e se nenhum servir, varrer todos.
 * Quem decide se presta é a normalização, não o rótulo do EVO.
 */
export function telefonesDoMembro(m: EvoMembro): string[] {
  const contatos = m.contacts ?? []
  const pareceCelular = (c: EvoContato) => /cel|mobil|whats/i.test(c.contactType ?? '')

  const ordenados = [...contatos.filter(pareceCelular), ...contatos.filter((c) => !pareceCelular(c))]

  return ordenados
    .map((c) => {
      const valor = (c.description ?? '').trim()
      if (!valor || valor.includes('@')) return null
      const ddi = (c.ddi ?? '').replace(/\D/g, '')
      // Só prefixa o DDI quando o número ainda não o carrega.
      return ddi && !valor.replace(/\D/g, '').startsWith(ddi) ? `+${ddi}${valor}` : valor
    })
    .filter((v): v is string => !!v)
}

/** Contrato vigente, ou o mais recente se nenhum estiver ativo. */
export function contratoAtual(m: EvoMembro): EvoMembership | null {
  const lista = m.memberships ?? []
  if (!lista.length) return null

  const ativo = lista.find((c) => mapearStatus(c.membershipStatus) === 'ATIVO' && !c.cancelDate)
  if (ativo) return ativo

  return [...lista].sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))[0] ?? null
}

/**
 * Acha o e-mail dentro de `contacts`.
 *
 * Mesma historia do telefone: o EVO nao tem campo de e-mail, tudo cai em
 * `description`. Aqui o criterio e o proprio valor, nao o rotulo: o que tem
 * arroba e e-mail, diga o contactType o que disser.
 */
export function emailDoMembro(m: EvoMembro): string | null {
  for (const c of m.contacts ?? []) {
    const valor = (c.description ?? '').trim()
    if (valor.includes('@') && valor.includes('.')) return valor.toLowerCase()
  }
  return null
}

/** Ultima passagem na catraca, quando o EVO manda. Base do CT-070. */
export function ultimoAcesso(m: EvoMembro): Date | null {
  if (!m.lastAccessDate) return null
  const d = new Date(m.lastAccessDate)
  return Number.isNaN(d.getTime()) ? null : d
}
