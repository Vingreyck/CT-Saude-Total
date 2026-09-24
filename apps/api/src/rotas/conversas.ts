import type { FastifyInstance } from 'fastify'
import { prisma } from '@ct/db'

/**
 * Caixa de entrada: todas as conversas, ao vivo (CT-046 + CT-063).
 *
 * Sobre "tempo real": aqui é sondagem a cada poucos segundos, não SSE nem
 * WebSocket. A escolha é deliberada.
 *
 * SSE guardaria a conexão dentro de um processo. No dia em que o Railway
 * subir uma segunda instância da API, a mensagem que chega na instância A não
 * alcança a atendente conectada na B, e o sintoma é o pior possível: a tela
 * simplesmente para de atualizar, sem erro, sem log. Sondagem não tem esse
 * problema, e a 3 segundos ninguém percebe diferença.
 *
 * Se um dia isso pesar, o caminho é LISTEN/NOTIFY do Postgres, que funciona
 * com várias instâncias. Não vale a complexidade hoje.
 */

/** Quantas conversas a lista traz por vez. */
const POR_PAGINA = 50

export async function rotasConversas(app: FastifyInstance) {
  /** A lista. É o que fica atualizando na tela da atendente. */
  app.get('/', async (req) => {
    const { filtro } = req.query as { filtro?: string }

    const onde =
      filtro === 'precisa-humano'
        ? { precisaHumano: true }
        : filtro === 'assumidas'
          ? { assumidaPorId: { not: null } }
          : {}

    const conversas = await prisma.conversa.findMany({
      where: onde,
      orderBy: { ultimaMensagemEm: 'desc' },
      take: POR_PAGINA,
      include: {
        membro: { select: { id: true, nome: true, plano: true, status: true } },
        mensagens: { orderBy: { criadoEm: 'desc' }, take: 1 },
      },
    })

    // Contadores do topo, numa consulta cada, para a atendente saber onde olhar.
    const [precisamHumano, assumidas, total] = await Promise.all([
      prisma.conversa.count({ where: { precisaHumano: true } }),
      prisma.conversa.count({ where: { assumidaPorId: { not: null } } }),
      prisma.conversa.count(),
    ])

    return {
      contadores: { precisamHumano, assumidas, total },
      conversas: conversas.map((c) => {
        const ultima = c.mensagens[0]
        return {
          id: c.id,
          membro: c.membro,
          precisaHumano: c.precisaHumano,
          motivoTriagem: c.motivoTriagem,
          assumida: !!c.assumidaPorId,
          ultimaMensagem: ultima
            ? {
                de: ultima.direcao === 'ENTRADA' ? 'aluno' : 'bot',
                texto: (ultima.texto ?? '').slice(0, 90),
                em: ultima.criadoEm,
              }
            : null,
          janelaAberta: !!c.janelaServicoExpiraEm && c.janelaServicoExpiraEm > new Date(),
        }
      }),
    }
  })

  /** Uma conversa inteira, com o que ela já virou dado. */
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    const conversa = await prisma.conversa.findUnique({
      where: { id },
      include: {
        membro: true,
        mensagens: { orderBy: { criadoEm: 'asc' }, take: 200 },
      },
    })
    if (!conversa) return reply.code(404).send({ erro: 'conversa não encontrada' })

    const resposta = await prisma.respostaPesquisa.findFirst({
      where: { membroId: conversa.membroId },
      orderBy: { iniciadaEm: 'desc' },
      include: { itens: { include: { pergunta: true, insights: true } } },
    })

    const optOut = await prisma.consentimento.findFirst({
      where: { membroId: conversa.membroId, status: 'OPT_OUT' },
    })

    return {
      id: conversa.id,
      membro: {
        id: conversa.membro.id,
        nome: conversa.membro.nome,
        plano: conversa.membro.plano,
        status: conversa.membro.status,
        telefone: conversa.membro.telefoneE164,
        desde: conversa.membro.inicioContrato,
      },
      precisaHumano: conversa.precisaHumano,
      motivoTriagem: conversa.motivoTriagem,
      assumida: !!conversa.assumidaPorId,
      optOut: !!optOut,
      janelaAberta: !!conversa.janelaServicoExpiraEm && conversa.janelaServicoExpiraEm > new Date(),
      mensagens: conversa.mensagens.map((m) => ({
        id: m.id,
        de: m.direcao === 'ENTRADA' ? 'aluno' : 'bot',
        texto: m.texto,
        em: m.criadoEm,
      })),
      nps: resposta?.nps ?? null,
      insights: (resposta?.itens ?? []).flatMap((i) =>
        i.insights.map((s) => ({
          sobre: i.pergunta.categoria ?? i.pergunta.enunciado,
          categoria: s.categoria,
          subcategoria: s.subcategoria,
          sentimento: s.sentimento,
          urgencia: s.urgencia,
          tags: s.tags,
        })),
      ),
    }
  })

  /**
   * A atendente responde. Isso ASSUME a conversa: o bot para de conduzir.
   *
   * Assumir junto com responder é de propósito. Se fossem dois botões, ia
   * acontecer de alguém responder sem assumir e o bot mandar a próxima
   * pergunta da pesquisa por cima, na frente do aluno.
   */
  app.post('/:id/responder', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { texto, quem } = (req.body ?? {}) as { texto?: string; quem?: string }

    if (!texto?.trim()) return reply.code(400).send({ erro: 'texto vazio' })

    const conversa = await prisma.conversa.findUnique({ where: { id } })
    if (!conversa) return reply.code(404).send({ erro: 'conversa não encontrada' })

    if (conversa.janelaServicoExpiraEm && conversa.janelaServicoExpiraEm < new Date()) {
      return reply.code(409).send({
        erro: 'a janela de 24h fechou. Só dá para reabrir com um template pago.',
      })
    }

    await prisma.conversa.update({
      where: { id },
      data: {
        assumidaPorId: quem?.trim() || 'equipe',
        assumidaEm: conversa.assumidaEm ?? new Date(),
        precisaHumano: false,
      },
    })

    const m = await prisma.mensagem.create({
      data: { conversaId: id, direcao: 'SAIDA', tipo: 'TEXTO', texto: texto.trim() },
    })

    // TODO CT-021: quando o numero real estiver no ar, e aqui que sai para a Meta.

    return { ok: true, mensagemId: m.id }
  })

  /** Devolve para o bot. */
  app.post('/:id/devolver', async (req) => {
    const { id } = req.params as { id: string }
    await prisma.conversa.update({
      where: { id },
      data: { assumidaPorId: null, assumidaEm: null, precisaHumano: false, motivoTriagem: null },
    })
    return { ok: true }
  })
}
