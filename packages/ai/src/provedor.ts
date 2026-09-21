import { z } from 'zod'

/**
 * Interface unica de IA (CT-040).
 *
 * O resto do sistema fala com isto, nunca com um SDK. Trocar de fornecedor e
 * trocar de implementacao e mexer numa variavel de ambiente, nao reescrever o
 * bot. A escolha atual esta em docs/04-comparativo-ia.md e vai ser revisada
 * depois da primeira campanha.
 */

export interface TurnoConversa {
  papel: 'aluno' | 'bot'
  texto: string
}

export interface ContextoConversa {
  /** Primeiro nome do aluno. So isso, nome completo em conversa soa cartorio. */
  nome: string
  /** Estado do fluxo de pesquisa, se houver um em andamento. */
  pesquisa?: {
    perguntaAtual: string
    perguntasRestantes: number
  }
  /** Fatos verificados sobre o aluno. O bot NUNCA pode afirmar nada fora disto. */
  fatos?: Record<string, string | number | null>
}

export interface RespostaConversa {
  texto: string
  tokensEntrada: number
  tokensSaida: number
  modelo: string
}

/** Taxonomia FECHADA. Modelo escolhe daqui, nao inventa. Ver schema.prisma. */
export const CATEGORIAS = [
  'estrutura',
  'equipamentos',
  'limpeza',
  'equipe',
  'aulas',
  'horarios',
  'preco',
  'atendimento',
  'resultado-do-treino',
  'outro',
] as const

export const ExtracaoSchema = z.object({
  categoria: z.enum(CATEGORIAS),
  subcategoria: z.string().nullable(),
  sentimento: z.enum(['POSITIVO', 'NEUTRO', 'NEGATIVO']),
  urgencia: z.enum(['BAIXA', 'MEDIA', 'ALTA']),
  entidades: z.object({
    professor: z.string().nullable(),
    equipamento: z.string().nullable(),
    local: z.string().nullable(),
    periodo: z.string().nullable(),
  }),
  tags: z.array(z.string()),
})

export type Extracao = z.infer<typeof ExtracaoSchema>

export const INTENCOES = [
  'FEEDBACK',
  'DUVIDA',
  'RECLAMACAO',
  'AGENDAMENTO',
  'COMERCIAL',
  'OPT_OUT',
  'OUTRO',
] as const

export type Intencao = (typeof INTENCOES)[number]

export interface ProvedorIA {
  /** Conduz um turno de conversa. A saida ainda passa pelo filtro humanizar(). */
  conversar(historico: TurnoConversa[], contexto: ContextoConversa): Promise<RespostaConversa>

  /** Transforma texto livre em linha consultavel. O diamante do projeto. */
  extrair(texto: string): Promise<Extracao>

  /** Classifica a intencao de uma mensagem recebida (CT-047). */
  classificarIntencao(texto: string): Promise<Intencao>
}
