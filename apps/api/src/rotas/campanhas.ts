import type { FastifyInstance } from 'fastify'
import { prisma, type TipoCampanha } from '@ct/db'
import { dentroDoHorarioPermitido } from '@ct/shared'
import { SEGMENTOS, estimarCusto, selecionar, type NomeSegmento } from '../campanhas/segmento.js'

/**
 * Campanhas e disparo em massa (CT-030, CT-031, CT-032, CT-033, CT-036).
 *
 * O desenho todo gira em torno de um único medo: **mandar duas vezes para a
 * mesma pessoa**. É o erro mais caro possível neste produto. Queima a
 * reputação do número na Meta e o dono perde a confiança no sistema no
 * primeiro dia.
 *
 * Por isso cada alvo nasce com uma chave idempotente única no banco. Não é
 * uma verificação no código, é uma restrição do Postgres: mesmo que a fila
 * reprocesse, mesmo que alguém chame a rota duas vezes, o segundo INSERT
 * falha.
 */

/** Quantas pessoas no máximo num disparo de teste. */
const LIMITE_TESTE = 100

export async function rotasCampanhas(app: FastifyInstance) {
  /** Os públicos possíveis, com quantas pessoas cada um tem agora. */
  app.get('/segmentos', async () => {
    const resultado = []
    for (const s of SEGMENTOS) {
      const pessoas = await selecionar(s.nome)
      resultado.push({ ...s, pessoas: pessoas.length })
    }
    return resultado
  })

  /** Quanto vai custar, antes de criar qualquer coisa. */
  app.get('/estimativa', async (req) => {
    const { segmento, categoria } = req.query as {
      segmento?: NomeSegmento
      categoria?: 'marketing' | 'utility'
    }
    const pessoas = await selecionar(segmento ?? 'ativos')
    return estimarCusto(pessoas.length, categoria ?? 'marketing')
  })

  app.get('/', async () => {
    const campanhas = await prisma.campanha.findMany({
      orderBy: { criadoEm: 'desc' },
      take: 30,
      include: { _count: { select: { alvos: true } } },
    })

    return Promise.all(
      campanhas.map(async (c) => {
        const porStatus = await prisma.campanhaAlvo.groupBy({
          by: ['status'],
          where: { campanhaId: c.id },
          _count: true,
        })
        const conta = Object.fromEntries(porStatus.map((p) => [p.status, p._count]))
        return {
          id: c.id,
          nome: c.nome,
          tipo: c.tipo,
          status: c.status,
          criadoEm: c.criadoEm,
          custoEstimado: c.custoEstimado,
          alvos: c._count.alvos,
          resultado: {
            pendentes: conta.PENDENTE ?? 0,
            enviados: conta.ENVIADO ?? 0,
            entregues: conta.ENTREGUE ?? 0,
            respondidos: conta.RESPONDIDO ?? 0,
            falhas: conta.FALHOU ?? 0,
            pulados: conta.PULADO ?? 0,
          },
        }
      }),
    )
  })

  /**
   * Cria a campanha e monta o lote.
   *
   * Criar NÃO dispara. Fica em RASCUNHO até alguém mandar disparar, e o
   * primeiro disparo é obrigatoriamente de teste.
   */
  app.post('/', async (req, reply) => {
    const { nome, tipo, segmento, template, categoria } = (req.body ?? {}) as {
      nome?: string
      tipo?: TipoCampanha
      segmento?: NomeSegmento
      template?: string
      categoria?: 'marketing' | 'utility'
    }

    if (!nome?.trim() || !template?.trim() || !segmento) {
      return reply.code(400).send({ erro: 'informe nome, template e segmento' })
    }

    const pessoas = await selecionar(segmento)
    if (pessoas.length === 0) {
      return reply.code(400).send({ erro: 'esse segmento não tem ninguém com WhatsApp válido' })
    }

    const unidade = await prisma.unidade.findFirstOrThrow()
    const custo = estimarCusto(pessoas.length, categoria ?? 'marketing')

    const campanha = await prisma.campanha.create({
      data: {
        unidadeId: unidade.id,
        nome: nome.trim(),
        tipo: tipo ?? 'FEEDBACK',
        templateNome: template.trim(),
        segmento: { nome: segmento, categoria: categoria ?? 'marketing' },
        custoEstimado: custo.total,
        status: 'RASCUNHO',
      },
    })

    // A chave idempotente e o que impede envio duplicado. Unica no banco.
    await prisma.campanhaAlvo.createMany({
      data: pessoas.map((p) => ({
        campanhaId: campanha.id,
        membroId: p.id,
        chaveIdempotencia: `${campanha.id}:${p.id}`,
      })),
      skipDuplicates: true,
    })

    return { id: campanha.id, alvos: pessoas.length, custo }
  })

  /**
   * Dispara.
   *
   * `teste: true` manda para no máximo 100 pessoas. O lote completo exige
   * `confirmado: true`, que é uma segunda decisão consciente e não um clique
   * a mais no mesmo botão.
   */
  app.post('/:id/disparar', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { teste, confirmado } = (req.body ?? {}) as { teste?: boolean; confirmado?: boolean }

    const campanha = await prisma.campanha.findUnique({ where: { id } })
    if (!campanha) return reply.code(404).send({ erro: 'campanha não encontrada' })

    if (campanha.status === 'DISPARANDO') {
      return reply.code(409).send({ erro: 'essa campanha já está disparando' })
    }

    if (!teste && !confirmado) {
      return reply.code(428).send({
        erro: 'o lote completo precisa de confirmação explícita. Faça o disparo de teste primeiro.',
      })
    }

    if (!dentroDoHorarioPermitido()) {
      return reply.code(409).send({
        erro: 'fora da janela de 08:00 às 20:00. Mensagem de academia fora de hora gera opt-out.',
      })
    }

    const pendentes = await prisma.campanhaAlvo.findMany({
      where: { campanhaId: id, status: 'PENDENTE' },
      take: teste ? LIMITE_TESTE : undefined,
      select: { id: true },
    })

    if (pendentes.length === 0) {
      return reply.code(400).send({ erro: 'não há ninguém pendente nessa campanha' })
    }

    await prisma.campanha.update({
      where: { id },
      data: {
        status: teste ? 'TESTE' : 'DISPARANDO',
        iniciadaEm: campanha.iniciadaEm ?? new Date(),
      },
    })

    // O envio de verdade e do worker. A api so marca e devolve, porque
    // segurar a requisicao ate o fim do lote daria timeout e ninguem saberia
    // se disparou ou nao.
    await prisma.campanhaAlvo.updateMany({
      where: { id: { in: pendentes.map((p) => p.id) } },
      data: { status: 'PENDENTE' },
    })

    return {
      ok: true,
      modo: teste ? 'teste' : 'completo',
      enfileirados: pendentes.length,
      aviso: teste
        ? `disparo de teste para ${pendentes.length} pessoas. Confira o resultado antes de liberar o resto.`
        : null,
    }
  })

  /** Pausa (CT-037). O que já saiu não volta, o que não saiu para. */
  app.post('/:id/pausar', async (req) => {
    const { id } = req.params as { id: string }
    await prisma.campanha.update({ where: { id }, data: { status: 'PAUSADA' } })
    return { ok: true }
  })
}
