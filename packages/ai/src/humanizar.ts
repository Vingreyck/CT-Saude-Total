/**
 * Filtro de humanizacao (CT-042).
 *
 * Por que isso existe em codigo e nao so no prompt: prompt vaza. Depois de 15
 * ou 20 turnos o modelo volta a soltar travessao, emoji e "fico feliz em
 * ajudar". O prompt reduz, o filtro garante.
 *
 * Roda SEMPRE, depois do modelo e antes do WhatsApp. Ver docs/05-persona-bot.md.
 */

export interface OpcoesHumanizar {
  /** Quantos emoji ainda podem sair nesta conversa. Padrao 0. */
  orcamentoEmoji?: number
  /** Teto de caracteres por mensagem antes de quebrar. */
  maxChars?: number
  /** Em quantas mensagens no maximo a resposta pode ser dividida. */
  maxPartes?: number
}

export interface ResultadoHumanizar {
  /** Mensagens prontas para enviar, na ordem. */
  mensagens: string[]
  /** Quantos emoji sobraram do orcamento, para persistir na conversa. */
  orcamentoEmojiRestante: number
  /** Quais regras precisaram agir. Serve para medir se o prompt esta piorando. */
  regrasAplicadas: string[]
}

/** Travessao, meia risca e a variante com espacos. O item numero 1 do dono. */
const TRAVESSAO = /\s*[—–]\s*/g

/** Negrito, italico e marcador de lista. Ninguem escreve assim no WhatsApp. */
const MARKDOWN_NEGRITO = /\*\*(.+?)\*\*/g
const MARKDOWN_ITALICO = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g
const MARKDOWN_LISTA = /^\s*[-*+]\s+/gm
const MARKDOWN_NUMERADA = /^\s*\d+\.\s+/gm

/**
 * Aberturas e fechamentos de robo de atendimento.
 *
 * A cauda e SEMPRE `[^.!?,]*[.!?,]?` e nunca `[^.!?]*[.!?]`. A diferenca
 * importa: sem a virgula no conjunto, "sua opiniao e muito importante para
 * nos, vou passar isso pro pessoal" e removida INTEIRA, levando junto o
 * conteudo de verdade. Isso aconteceu, e o teste "saida composta" existe
 * exatamente para impedir que volte.
 */
const FRASES_PROIBIDAS: Array<[RegExp, string]> = [
  [/^\s*(ol[áa]|oi)[,!.]?\s*(tudo bem|como (posso|vai|voc[êe] est[áa]))[^.!?,]*[.!?,]?\s*/i, 'abertura_corporativa'],
  [/^\s*(claro|perfeito|com certeza|entendido|excelente pergunta)[!.,]\s+/i, 'abertura_reflexa'],
  [/espero que esteja tudo bem[.!,]?\s*/gi, 'espero_que_esteja_bem'],
  [/fico (feliz|[àa] disposi[çc][ãa]o)[^.!?,]*[.!?,]?\s*/gi, 'fico_feliz'],
  [/n[ãa]o hesite em[^.!?,]*[.!?,]?\s*/gi, 'nao_hesite'],
  [/estou (aqui |sempre )?(à|a) (sua )?disposi[çc][ãa]o[^.!?,]*[.!?,]?\s*/gi, 'a_disposicao'],
  [/sua opini[ãa]o [ée] (muito )?importante[^.!?,]*[.!?,]?\s*/gi, 'opiniao_importante'],
  [/(agradecemos|agradeço) (o seu|seu|pelo) (contato|feedback|retorno)[^.!?,]*[.!?,]?\s*/gi, 'agradecemos_contato'],
  [/^\s*(resumindo|em resumo|para resumir)[,:]\s*/gim, 'frase_de_resumo'],
  [/posso ajudar em mais (alguma coisa|algo)[?!.]?\s*/gi, 'posso_ajudar_mais'],
  // Interjeicao reflexa de abertura. O modelo usa como muleta em toda
  // resposta de reclamacao, e repetida vira tique, nao empatia.
  [/^\s*(putz|puts|puxa)[,!.\s]+/i, 'interjeicao_reflexa'],
]

const EMOJI = /\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/gu

export function humanizar(texto: string, opcoes: OpcoesHumanizar = {}): ResultadoHumanizar {
  const { orcamentoEmoji = 0, maxChars = 280, maxPartes = 2 } = opcoes
  const regras: string[] = []
  let t = texto

  // 1. travessao vira virgula. Regra numero 1 do dono.
  if (TRAVESSAO.test(t)) {
    regras.push('travessao')
    t = t.replace(TRAVESSAO, ', ')
  }

  // 2. markdown nao existe no WhatsApp
  const antesMd = t
  t = t
    .replace(MARKDOWN_NEGRITO, '$1')
    .replace(MARKDOWN_ITALICO, '$1')
    .replace(MARKDOWN_LISTA, '')
    .replace(MARKDOWN_NUMERADA, '')
  if (t !== antesMd) regras.push('markdown')

  // 3. frases de robo de atendimento
  const antesDasFrases = t
  for (const [re, nome] of FRASES_PROIBIDAS) {
    const antes = t
    t = t.replace(re, '')
    if (t !== antes) regras.push(nome)
  }

  // Rede de seguranca: se a limpeza esvaziou a mensagem, a resposta do modelo
  // era so protocolo. Mandar a frase levemente robotica e melhor que mandar
  // nada e deixar o aluno no vacuo esperando.
  //
  // O limiar e "vazio", nao uma porcentagem: mensagem curta que e quase toda
  // frase de robo (tipo "anotado. Sua opiniao e muito importante para nos!")
  // DEVE mesmo encolher para "anotado.".
  if (antesDasFrases.trim() && !t.trim()) {
    regras.push('restaurado_por_seguranca')
    t = antesDasFrases
  }

  // 4. emoji dentro do orcamento da conversa
  const { texto: semExcesso, restante, cortou } = limitarEmoji(t, orcamentoEmoji)
  t = semExcesso
  if (cortou) regras.push('emoji')

  // 5. exclamacao em serie e reticencia dramatica
  if (/!{2,}|\.{4,}/.test(t)) {
    regras.push('pontuacao_excessiva')
    t = t.replace(/!{2,}/g, '!').replace(/\.{4,}/g, '...')
  }

  // 6. sobra de espaco depois de remover frase
  t = t.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

  return {
    mensagens: quebrarEmMensagens(t, maxChars, maxPartes),
    orcamentoEmojiRestante: restante,
    regrasAplicadas: [...new Set(regras)],
  }
}

export function limitarEmoji(
  texto: string,
  orcamento: number,
): { texto: string; restante: number; cortou: boolean } {
  let restante = orcamento
  let cortou = false

  const resultado = texto.replace(EMOJI, (match) => {
    if (restante > 0) {
      restante -= 1
      return match
    }
    cortou = true
    return ''
  })

  return { texto: resultado.replace(/[ \t]{2,}/g, ' ').trim(), restante, cortou }
}

/**
 * Quebra em mensagens curtas, cortando em fim de frase e nunca no meio de uma
 * palavra. Duas mensagens curtas parecem gente digitando; um paragrafo unico
 * de 600 caracteres parece e-mail.
 */
export function quebrarEmMensagens(texto: string, maxChars = 280, maxPartes = 2): string[] {
  const limpo = texto.trim()
  if (!limpo) return []
  if (limpo.length <= maxChars || maxPartes <= 1) return [limpo]

  const frases = limpo.match(/[^.!?\n]+[.!?]*\n*/g) ?? [limpo]
  const partes: string[] = []
  let atual = ''

  for (const frase of frases) {
    if (atual && (atual + frase).trim().length > maxChars) {
      partes.push(atual.trim())
      atual = frase
    } else {
      atual += frase
    }
  }
  if (atual.trim()) partes.push(atual.trim())

  if (partes.length <= maxPartes) return partes

  // Estourou o numero de partes: o excedente vai junto na ultima permitida,
  // em vez de ser descartado. Perder o fim da resposta e pior que uma
  // mensagem um pouco mais longa.
  const cabeca = partes.slice(0, maxPartes - 1)
  const cauda = partes.slice(maxPartes - 1).join(' ')
  return [...cabeca, cauda]
}

/**
 * Atraso antes de responder (CT-044). Resposta instantanea toda vez e
 * assinatura de robo. Teto de 4s para nao parecer que o sistema caiu.
 */
export function calcularAtrasoDigitacao(texto: string, msPorCaractere = 18): number {
  return Math.min(4000, Math.max(700, texto.length * msPorCaractere))
}
