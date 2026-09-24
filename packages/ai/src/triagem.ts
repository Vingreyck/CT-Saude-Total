/**
 * Triagem determinística, antes de qualquer chamada de IA (CT-045).
 *
 * O padrão de mercado para chatbot em produção é defesa em camadas, e a
 * primeira camada é sempre de regra, não de modelo:
 *
 *   1. regra determinística  <- este arquivo
 *   2. o modelo de linguagem
 *   3. filtro na saída       <- humanizar()
 *
 * Três motivos para o que é crítico não passar pelo modelo:
 *
 * - **Obrigação legal.** Opt-out é direito do titular pela LGPD e precisa ser
 *   atendido de imediato. A ANPD aumentou a fiscalização disso em 2026 e a
 *   multa chega a 2% do faturamento. Deixar um modelo decidir se a pessoa
 *   pediu para sair é apostar dinheiro da academia numa probabilidade.
 * - **Custo e latência.** Quem escreveu "para" não precisa de chamada de IA.
 * - **Auditoria.** Quando o dono perguntar por que fulano parou de receber,
 *   a resposta é uma regra que dá para ler, não "o modelo entendeu assim".
 */

export type AcaoTriagem = 'seguir' | 'opt_out' | 'chamar_humano' | 'responder_robo'

export interface ResultadoTriagem {
  acao: AcaoTriagem
  /** Resposta pronta, quando a triagem já resolve sem chamar o modelo. */
  resposta?: string
  /** Qual regra disparou. Vai para o log e para o painel. */
  motivo?: string
}

/**
 * Pedido inequívoco de parar de receber.
 *
 * "cancelar" sozinho NÃO entra aqui de propósito: numa academia, "quero
 * cancelar" quase sempre é o plano, não a mensagem. Tratar isso como opt-out
 * silenciaria justamente o aluno que está saindo, que é quem o dono mais
 * precisa ouvir. Esse caso vai para humano.
 */
const OPT_OUT: RegExp[] = [
  /^\s*(parar?|pare|sair|stop|remover?)\s*[.!]?\s*$/i,
  /\b(n[ãa]o|nao)\s+quero\s+(mais\s+)?receber\b/i,
  /\b(n[ãa]o|nao)\s+me\s+(mande|manda|envie|envia)\s+mais\b/i,
  /\bpar[ae]\s+de\s+(me\s+)?(mandar|enviar|encher|perturbar)\b/i,
  /\b(me\s+)?(tira|tire|remova|remove)\s+(d[ae]ss[ae]|d[ao])\s*(lista|grupo)?\b/i,
  /\bdescadastr\w*/i,
  /\b(sair|saia)\s+d[ae]\s*lista\b/i,
  /\bcancelar\s+(o\s+)?(envio|recebimento|as\s+mensagens)\b/i,
]

/**
 * Sinais de que a pessoa está irritada.
 *
 * Aqui o objetivo não é moderar o aluno, é parar de coletar. Insistir em
 * pesquisa com cliente irritado queima o cliente e o canal.
 */
const IRRITADO: RegExp[] = [
  /\b(porra|merda|caralho|foda-se|fodase|puta que pariu|vai se f)\w*/i,
  /\b(que\s+saco|saco\s+viu|enche[rs]?\s+o\s+saco|t[ôo]\s+de\s+saco\s+cheio)\b/i,
  /\b(p[ée]ssimo|horr[ií]vel|lixo|vergonha)\b.{0,40}\b(academia|atendimento|lugar)\b/i,
  /\b(quero|vou)\s+(falar|reclamar)\s+com\s+(o\s+)?(dono|gerente|respons[áa]vel)\b/i,
  /\bprocon\b/i,
]

/**
 * Perguntou se está falando com gente. Nunca mentir sobre isso.
 *
 * ATENÇÃO, vale para qualquer regex em português deste projeto: não use \b
 * depois de palavra acentuada. Em JavaScript o \b é ASCII, e "robô" termina
 * num caractere que ele considera não-palavra, então /rob[ôo]\b/ nunca casa
 * com "robô?". Use a antevisão (?=$|[\s,.!?;]) no lugar.
 */
const PERGUNTA_ROBO: RegExp[] = [
  /(voc[êe]|vc|tu)\s+([ée]|eh)\s+(um\s+|uma\s+)?(rob[ôo]|b[ôo]t|m[áa]quina|ia|intelig[êe]ncia artificial|gpt|chatgpt)(?=$|[\s,.!?;])/i,
  /(isso|isto|aqui)\s+([ée]|eh)\s+(um\s+|uma\s+)?(rob[ôo]|b[ôo]t|m[áa]quina|ia)(?=$|[\s,.!?;])/i,
  /(voc[êe]|vc|tu)\s+([ée]|eh)\s+(humano|gente|pessoa|de verdade)(?=$|[\s,.!?;])/i,
  /(t[ôo]|estou|to)\s+falando\s+com\s+(um[a]?\s+)?(rob[ôo]|b[ôo]t|m[áa]quina|pessoa|humano|gente)(?=$|[\s,.!?;])/i,
]

const casa = (texto: string, regras: RegExp[]) => regras.some((r) => r.test(texto))

export interface OpcoesTriagem {
  /** Nome que o bot usa. Entra na resposta sobre ser robô. */
  nomeBot?: string
  nomeAcademia?: string
}

export function triar(texto: string, opcoes: OpcoesTriagem = {}): ResultadoTriagem {
  const t = texto.trim()
  const { nomeBot = 'Rafa', nomeAcademia = 'CT Saúde Total' } = opcoes

  if (!t) return { acao: 'seguir' }

  // Ordem importa: opt-out vem primeiro porque é obrigação legal e não pode
  // ser ofuscado por outra regra que também case.
  if (casa(t, OPT_OUT)) {
    return {
      acao: 'opt_out',
      motivo: 'pedido de opt-out',
      resposta:
        'beleza, não te mando mais nada. se um dia quiser falar com a gente é só chamar aqui',
    }
  }

  if (casa(t, IRRITADO)) {
    return {
      acao: 'chamar_humano',
      motivo: 'aluno irritado',
      resposta:
        'foi mal, não era pra ter sido assim. vou pedir pra alguém da equipe te chamar aqui hoje ainda',
    }
  }

  if (casa(t, PERGUNTA_ROBO)) {
    return {
      acao: 'responder_robo',
      motivo: 'perguntou se é robô',
      resposta: `sou o atendimento automático do ${nomeAcademia}, quem tá do outro lado é um sistema. mas se quiser falar com alguém da equipe eu chamo, é só pedir. a ${nomeBot} aqui é o nome que a gente deu pro atendimento`,
    }
  }

  return { acao: 'seguir' }
}

/**
 * Vale a pena insistir nesta pergunta?
 *
 * Depois de duas tentativas sem entender, o bot para de repetir e segue. Ficar
 * insistindo na mesma pergunta é o jeito mais rápido de a pessoa abandonar a
 * conversa, e o que ela escreveu fica gravado do mesmo jeito.
 */
export const MAX_TENTATIVAS_POR_PERGUNTA = 2
