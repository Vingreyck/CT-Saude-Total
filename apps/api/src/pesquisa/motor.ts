import { prisma, type Pergunta, type RespostaPesquisa } from '@ct/db'
import {
  criarProvedorIA,
  humanizar,
  triar,
  MAX_TENTATIVAS_POR_PERGUNTA,
  type ContextoConversa,
} from '@ct/ai'
import { calcularFimJanelaServico } from '@ct/shared'

/**
 * Motor da pesquisa (CT-050 + CT-051 + CT-053).
 *
 * Recebe o que o aluno escreveu, grava de forma estruturada, e devolve o que
 * o bot responde. É o coração da coleta.
 *
 * Duas regras que moldam o desenho:
 *
 * 1. **Nada se perde no meio.** Cada resposta cai no banco na hora, não no
 *    fim. Quem responde 3 de 6 perguntas já entregou dado útil.
 * 2. **Reação e próxima pergunta vão na MESMA mensagem.** Duas mensagens
 *    curtas parecem mais humanas, mas a partir de 01/10/2026 a Meta cobra por
 *    mensagem dentro da janela de serviço, e cada quebra dobraria o custo do
 *    turno. Parecer humano aqui é responsabilidade do texto, não da quebra.
 */

/** Quantos itens de nota rotativos cada aluno recebe. */
const ROTATIVAS_POR_ALUNO = 2

export interface ResultadoTurno {
  respostas: string[]
  /** Qual regra da triagem agiu, quando agiu. Vai para o painel e o log. */
  triagem?: string
  concluida: boolean
  perguntaAtual: string | null
  restantes: number
  capturado: { pergunta: string; valor: string } | null
  regrasDeHumanizacao: string[]
}

/**
 * Sorteia as rotativas a partir do id da resposta, não de Math.random().
 *
 * Assim a escolha é estável: reprocessar o mesmo atendimento dá o mesmo
 * conjunto, e não precisa de coluna nova no banco para guardar o sorteio.
 */
function rotativasDoAluno(respostaId: string, disponiveis: Pergunta[]): Pergunta[] {
  if (disponiveis.length <= ROTATIVAS_POR_ALUNO) return disponiveis

  let semente = 0
  for (const c of respostaId) semente = (semente * 31 + c.charCodeAt(0)) >>> 0

  const ordenadas = [...disponiveis].sort((a, b) => a.ordem - b.ordem)
  const escolhidas: Pergunta[] = []
  for (let i = 0; i < ROTATIVAS_POR_ALUNO; i++) {
    semente = (semente * 1103515245 + 12345) >>> 0
    const idx = semente % ordenadas.length
    const [p] = ordenadas.splice(idx, 1)
    if (p) escolhidas.push(p)
  }
  return escolhidas
}

/** O roteiro daquele aluno: núcleo na ordem, com as rotativas no meio. */
async function roteiro(resposta: RespostaPesquisa): Promise<Pergunta[]> {
  const todas = await prisma.pergunta.findMany({
    where: { pesquisaId: resposta.pesquisaId },
    orderBy: { ordem: 'asc' },
  })
  const nucleo = todas.filter((p) => !p.rotativa)
  const sorteadas = rotativasDoAluno(resposta.id, todas.filter((p) => p.rotativa))

  return [...nucleo, ...sorteadas].sort((a, b) => a.ordem - b.ordem)
}

const NUMEROS_ESCRITOS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4,
  cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
}

/**
 * Tira um número do que o aluno escreveu.
 *
 * Gente responde "8", "oito", "uns 8", "nota 9 viu". Mandar isso para a IA
 * seria caro e mais lento do que resolver aqui, e erraria mais.
 */
export function interpretarNota(texto: string, min: number, max: number): number | null {
  const limpo = texto.toLowerCase().trim()

  const digito = limpo.match(/\d+/)
  if (digito) {
    const n = Number(digito[0])
    if (!Number.isNaN(n)) return Math.min(max, Math.max(min, n))
  }

  for (const [palavra, n] of Object.entries(NUMEROS_ESCRITOS)) {
    if (new RegExp(`\\b${palavra}\\b`).test(limpo)) return Math.min(max, Math.max(min, n))
  }

  return null
}

/** Gravação estruturada de uma resposta. É o que transforma conversa em dado. */
async function gravarResposta(
  resposta: RespostaPesquisa,
  pergunta: Pergunta,
  texto: string,
): Promise<{ valor: string }> {
  const dados: { valorNum?: number; valorTexto?: string; valorOpcao?: string } = {}

  if (pergunta.tipo === 'NOTA' || pergunta.tipo === 'ESCALA_NPS') {
    const n = interpretarNota(texto, pergunta.minimo ?? 0, pergunta.maximo ?? 10)
    if (n === null) return { valor: '' } // não entendeu: o bot repergunta
    dados.valorNum = n
    if (pergunta.tipo === 'ESCALA_NPS') {
      await prisma.respostaPesquisa.update({ where: { id: resposta.id }, data: { nps: n } })
    }
  } else if (pergunta.tipo === 'OPCAO') {
    const achou = pergunta.opcoes.find((o) => texto.toLowerCase().includes(o.toLowerCase()))
    dados.valorOpcao = achou ?? texto
  } else {
    dados.valorTexto = texto
  }

  const item = await prisma.respostaItem.upsert({
    where: {
      respostaPesquisaId_perguntaId: { respostaPesquisaId: resposta.id, perguntaId: pergunta.id },
    },
    update: dados,
    create: { respostaPesquisaId: resposta.id, perguntaId: pergunta.id, ...dados },
  })

  // Texto livre vira linha consultavel. Roda sem travar a resposta ao aluno:
  // se a extracao falhar, a conversa segue e o texto original continua no
  // banco para reprocessar depois.
  if (dados.valorTexto && dados.valorTexto.trim().length > 3) {
    void extrairEmSegundoPlano(item.id, dados.valorTexto)
  }

  return {
    valor: String(dados.valorNum ?? dados.valorOpcao ?? dados.valorTexto ?? ''),
  }
}

async function extrairEmSegundoPlano(respostaItemId: string, texto: string) {
  try {
    const ia = criarProvedorIA()
    const e = await ia.extrair(texto)
    await prisma.insight.create({
      data: {
        origem: 'RESPOSTA_ITEM',
        respostaItemId,
        categoria: e.categoria,
        subcategoria: e.subcategoria,
        sentimento: e.sentimento,
        urgencia: e.urgencia,
        entidades: e.entidades,
        tags: e.tags,
      },
    })
  } catch (erro) {
    console.error('extracao falhou para', respostaItemId, (erro as Error).message)
  }
}

/** Um turno: o aluno falou, o bot responde. */
export async function processarMensagem(
  membroId: string,
  texto: string,
): Promise<ResultadoTurno> {
  const membro = await prisma.membro.findUniqueOrThrow({ where: { id: membroId } })

  const conversa = await prisma.conversa.upsert({
    where: { id: (await prisma.conversa.findFirst({ where: { membroId } }))?.id ?? 'novo' },
    update: {
      ultimaMensagemEm: new Date(),
      janelaServicoExpiraEm: calcularFimJanelaServico(new Date()),
    },
    create: {
      membroId,
      ultimaMensagemEm: new Date(),
      janelaServicoExpiraEm: calcularFimJanelaServico(new Date()),
    },
  })

  await prisma.mensagem.create({
    data: { conversaId: conversa.id, direcao: 'ENTRADA', tipo: 'TEXTO', texto },
  })

  // ---- camada 1: regra deterministica, antes de qualquer chamada de IA ----
  const t = triar(texto)

  if (t.acao !== 'seguir') {
    if (t.acao === 'opt_out') {
      // Direito do titular pela LGPD. Registrado no banco, nao so no fluxo,
      // porque e o registro que bloqueia o disparo depois.
      await prisma.consentimento.upsert({
        where: {
          membroId_canal_finalidade: {
            membroId,
            canal: 'WHATSAPP',
            finalidade: 'comunicacao',
          },
        },
        update: { status: 'OPT_OUT', origem: 'pedido do aluno na conversa' },
        create: {
          membroId,
          canal: 'WHATSAPP',
          status: 'OPT_OUT',
          finalidade: 'comunicacao',
          origem: 'pedido do aluno na conversa',
          textoAceito: texto,
        },
      })
      await prisma.respostaPesquisa.updateMany({
        where: { membroId, status: { in: ['INICIADA', 'PARCIAL'] } },
        data: { status: 'ABANDONADA' },
      })
    }

    if (t.acao === 'chamar_humano') {
      await prisma.conversa.update({
        where: { id: conversa.id },
        data: { precisaHumano: true, motivoTriagem: t.motivo ?? null },
      })
    }

    const saida = t.resposta ?? ''
    if (saida) {
      await prisma.mensagem.create({
        data: { conversaId: conversa.id, direcao: 'SAIDA', tipo: 'TEXTO', texto: saida },
      })
    }

    return {
      respostas: saida ? [saida] : [],
      concluida: t.acao === 'opt_out',
      perguntaAtual: null,
      restantes: 0,
      capturado: null,
      regrasDeHumanizacao: [],
      triagem: t.motivo,
    }
  }

  // Conversa ja escalada: o bot nao volta a conduzir pesquisa por conta propria.
  if (conversa.precisaHumano) {
    const aviso = 'já avisei a equipe, alguém te chama aqui. se quiser adiantar alguma coisa pode falar'
    await prisma.mensagem.create({
      data: { conversaId: conversa.id, direcao: 'SAIDA', tipo: 'TEXTO', texto: aviso },
    })
    return {
      respostas: [aviso],
      concluida: false,
      perguntaAtual: null,
      restantes: 0,
      capturado: null,
      regrasDeHumanizacao: [],
      triagem: 'aguardando equipe',
    }
  }

  const pesquisa = await prisma.pesquisa.findFirstOrThrow({ where: { ativa: true } })

  let resposta = await prisma.respostaPesquisa.findFirst({
    where: { membroId, pesquisaId: pesquisa.id, status: { in: ['INICIADA', 'PARCIAL'] } },
    orderBy: { iniciadaEm: 'desc' },
  })
  if (!resposta) {
    resposta = await prisma.respostaPesquisa.create({
      data: { pesquisaId: pesquisa.id, membroId, status: 'INICIADA' },
    })
  }

  const plano = await roteiro(resposta)
  const jaRespondidas = await prisma.respostaItem.findMany({
    where: { respostaPesquisaId: resposta.id },
    select: { perguntaId: true },
  })
  const respondidas = new Set(jaRespondidas.map((r) => r.perguntaId))

  // A pergunta que estava no ar é a primeira ainda sem resposta.
  const pendente = plano.find((p) => !respondidas.has(p.id)) ?? null

  let capturado: ResultadoTurno['capturado'] = null

  // A primeira mensagem do aluno é o aceite, não resposta de pergunta nenhuma.
  const eAbertura = respondidas.size === 0 && (await contarSaidas(conversa.id)) === 0

  if (pendente && !eAbertura) {
    const { valor } = await gravarResposta(resposta, pendente, texto)

    if (valor !== '') {
      respondidas.add(pendente.id)
      capturado = { pergunta: pendente.enunciado, valor }
    } else {
      // Nao deu para interpretar. Quantas vezes o aluno ja respondeu desde a
      // ultima captura? Contar mensagens evita coluna nova so para isso.
      const ultimoItem = await prisma.respostaItem.findFirst({
        where: { respostaPesquisaId: resposta.id },
        orderBy: { criadoEm: 'desc' },
      })
      const tentativas = await prisma.mensagem.count({
        where: {
          conversaId: conversa.id,
          direcao: 'ENTRADA',
          criadoEm: { gt: ultimoItem?.criadoEm ?? resposta.iniciadaEm },
        },
      })

      if (tentativas >= MAX_TENTATIVAS_POR_PERGUNTA) {
        // Desiste da pergunta e segue. Insistir na mesma coisa e o jeito mais
        // rapido de a pessoa abandonar a conversa. O que ela escreveu fica
        // gravado como texto, entao nada se perde.
        await prisma.respostaItem.upsert({
          where: {
            respostaPesquisaId_perguntaId: {
              respostaPesquisaId: resposta.id,
              perguntaId: pendente.id,
            },
          },
          update: { valorTexto: texto },
          create: {
            respostaPesquisaId: resposta.id,
            perguntaId: pendente.id,
            valorTexto: texto,
          },
        })
        respondidas.add(pendente.id)
        capturado = { pergunta: pendente.enunciado, valor: texto }
      }
    }
  }

  const proxima = plano.find((p) => !respondidas.has(p.id)) ?? null
  const restantes = plano.filter((p) => !respondidas.has(p.id)).length

  if (!proxima) {
    await prisma.respostaPesquisa.update({
      where: { id: resposta.id },
      data: { status: 'CONCLUIDA', concluidaEm: new Date() },
    })
  } else if (respondidas.size > 0) {
    await prisma.respostaPesquisa.update({
      where: { id: resposta.id },
      data: { status: 'PARCIAL' },
    })
  }

  const historico = await prisma.mensagem.findMany({
    where: { conversaId: conversa.id },
    orderBy: { criadoEm: 'asc' },
    take: 40,
  })

  const contexto: ContextoConversa = {
    nome: membro.nome.split(' ')[0] ?? membro.nome,
    fatos: {
      plano: membro.plano,
      'aluno desde': membro.inicioContrato?.toLocaleDateString('pt-BR') ?? null,
    },
    ...(proxima
      ? { pesquisa: { perguntaAtual: proxima.enunciado, perguntasRestantes: restantes - 1 } }
      : {}),
  }

  const ia = criarProvedorIA()
  const bruta = await ia.conversar(
    historico.map((m) => ({
      papel: m.direcao === 'ENTRADA' ? ('aluno' as const) : ('bot' as const),
      texto: m.texto ?? '',
    })),
    contexto,
  )

  // Uma mensagem por turno, de propósito. Ver o comentário no topo do arquivo.
  const limpo = humanizar(bruta.texto, { maxPartes: 1 })

  for (const t of limpo.mensagens) {
    await prisma.mensagem.create({
      data: { conversaId: conversa.id, direcao: 'SAIDA', tipo: 'TEXTO', texto: t },
    })
  }

  return {
    respostas: limpo.mensagens,
    concluida: !proxima,
    perguntaAtual: proxima?.enunciado ?? null,
    restantes,
    capturado,
    regrasDeHumanizacao: limpo.regrasAplicadas,
  }
}

async function contarSaidas(conversaId: string): Promise<number> {
  return prisma.mensagem.count({ where: { conversaId, direcao: 'SAIDA' } })
}
