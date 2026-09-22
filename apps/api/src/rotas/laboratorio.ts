import type { FastifyInstance } from 'fastify'
import { prisma } from '@ct/db'
import { provedorAtual } from '@ct/ai'
import { processarMensagem } from '../pesquisa/motor.js'

/**
 * Laboratorio: conversar com o bot pelo painel, sem WhatsApp.
 *
 * Existe para o dono conseguir VER a coleta funcionando antes de existir
 * numero verificado e antes de gastar um centavo com template. O caminho
 * percorrido e o mesmo da conversa real: mesma gravacao, mesma extracao,
 * mesmo filtro de humanizacao. So nao sai para a Meta.
 */
export async function rotasLaboratorio(app: FastifyInstance) {
  /** Com quem o dono vai conversar. Pega um aluno de teste qualquer. */
  app.get('/membro', async () => {
    const membro =
      (await prisma.membro.findFirst({
        where: { tags: { has: 'base-teste' }, status: 'ATIVO', telefoneValido: true },
        orderBy: { criadoEm: 'asc' },
      })) ?? (await prisma.membro.findFirst({ orderBy: { criadoEm: 'asc' } }))

    if (!membro) {
      return { erro: 'sem alunos no banco. Rode npm run base:gerar' }
    }

    return {
      id: membro.id,
      nome: membro.nome,
      plano: membro.plano,
      provedorIA: provedorAtual(),
    }
  })

  /** Um turno de conversa. */
  app.post('/mensagem', async (req, reply) => {
    const { membroId, texto } = (req.body ?? {}) as { membroId?: string; texto?: string }

    if (!membroId || !texto?.trim()) {
      return reply.code(400).send({ erro: 'informe membroId e texto' })
    }
    if (provedorAtual() === 'nenhum') {
      return reply.code(503).send({
        erro: 'nenhuma chave de IA configurada. Defina ANTHROPIC_API_KEY ou API_GEMINI.',
      })
    }

    try {
      return await processarMensagem(membroId, texto.trim())
    } catch (e) {
      app.log.error({ err: e }, 'falha no turno de conversa')
      return reply.code(500).send({ erro: (e as Error).message })
    }
  })

  /** Tudo que a conversa ja capturou. E isto que prova o valor do projeto. */
  app.get('/estado/:membroId', async (req) => {
    const { membroId } = req.params as { membroId: string }

    const conversa = await prisma.conversa.findFirst({
      where: { membroId },
      orderBy: { criadoEm: 'desc' },
    })

    const mensagens = conversa
      ? await prisma.mensagem.findMany({
          where: { conversaId: conversa.id },
          orderBy: { criadoEm: 'asc' },
        })
      : []

    const resposta = await prisma.respostaPesquisa.findFirst({
      where: { membroId },
      orderBy: { iniciadaEm: 'desc' },
      include: {
        itens: { include: { pergunta: true, insights: true }, orderBy: { criadoEm: 'asc' } },
      },
    })

    return {
      mensagens: mensagens.map((m) => ({
        de: m.direcao === 'ENTRADA' ? 'aluno' : 'bot',
        texto: m.texto,
        em: m.criadoEm,
      })),
      nps: resposta?.nps ?? null,
      status: resposta?.status ?? null,
      itens: (resposta?.itens ?? []).map((i) => ({
        pergunta: i.pergunta.enunciado,
        categoria: i.pergunta.categoria,
        tipo: i.pergunta.tipo,
        valor: i.valorNum ?? i.valorOpcao ?? i.valorTexto,
        insights: i.insights.map((s) => ({
          categoria: s.categoria,
          subcategoria: s.subcategoria,
          sentimento: s.sentimento,
          urgencia: s.urgencia,
          entidades: s.entidades,
          tags: s.tags,
        })),
      })),
    }
  })

  /** Recomeca do zero, para testar de novo. So apaga o que e de teste. */
  app.post('/reiniciar/:membroId', async (req) => {
    const { membroId } = req.params as { membroId: string }
    const conversas = await prisma.conversa.findMany({ where: { membroId }, select: { id: true } })
    await prisma.mensagem.deleteMany({ where: { conversaId: { in: conversas.map((c) => c.id) } } })
    await prisma.conversa.deleteMany({ where: { membroId } })
    await prisma.respostaPesquisa.deleteMany({ where: { membroId } })
    return { ok: true }
  })
}
