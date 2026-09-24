import type { Job } from 'pg-boss'
import { prisma } from '@ct/db'
import { criarCanal } from '@ct/whatsapp'
import { dentroDoHorarioPermitido, calcularFimJanelaServico } from '@ct/shared'

/**
 * Disparo em massa (CT-031 + CT-032).
 *
 * Roda a cada minuto e manda no máximo um lote por vez. A vazão sai do
 * relógio, não de um laço apertado: é o jeito mais simples de respeitar o
 * limite da Meta sem inventar um semáforo distribuído.
 *
 * As quatro travas, todas conferidas NA HORA DO ENVIO e não na montagem do
 * lote, porque entre montar e enviar podem passar horas:
 *
 * 1. campanha ainda ativa (pausar tem que parar de verdade)
 * 2. dentro da janela de 08:00 às 20:00
 * 3. a pessoa não pediu para sair nesse meio tempo
 * 4. aquele alvo ainda está PENDENTE
 */

const POR_MINUTO = Number(process.env.DISPARO_MSG_POR_MINUTO ?? 30)

export async function dispararMensagem(_jobs: Job[]) {
  if (!dentroDoHorarioPermitido()) return

  const ativas = await prisma.campanha.findMany({
    where: { status: { in: ['TESTE', 'DISPARANDO'] } },
    select: { id: true, nome: true, templateNome: true, status: true },
  })
  if (ativas.length === 0) return

  const canal = criarCanal()
  let enviados = 0
  let pulados = 0
  let falhas = 0

  for (const campanha of ativas) {
    if (enviados + pulados + falhas >= POR_MINUTO) break

    const alvos = await prisma.campanhaAlvo.findMany({
      where: { campanhaId: campanha.id, status: 'PENDENTE' },
      take: POR_MINUTO - (enviados + pulados + falhas),
      include: {
        membro: {
          select: {
            id: true,
            nome: true,
            telefoneE164: true,
            consentimentos: { where: { status: 'OPT_OUT', canal: 'WHATSAPP' }, take: 1 },
          },
        },
      },
    })

    for (const alvo of alvos) {
      // Trava 3: pediu para sair depois que o lote foi montado.
      if (alvo.membro.consentimentos.length > 0 || !alvo.membro.telefoneE164) {
        await prisma.campanhaAlvo.update({
          where: { id: alvo.id },
          data: {
            status: 'PULADO',
            erro: alvo.membro.consentimentos.length > 0 ? 'opt-out' : 'sem telefone valido',
          },
        })
        pulados++
        continue
      }

      // Trava 4: so sai quem ainda esta pendente. O updateMany com filtro de
      // status e a garantia final contra envio duplo: se dois processos
      // pegarem o mesmo alvo, so um consegue mudar a linha.
      const reservou = await prisma.campanhaAlvo.updateMany({
        where: { id: alvo.id, status: 'PENDENTE' },
        data: { status: 'ENVIADO', tentativas: { increment: 1 }, enviadoEm: new Date() },
      })
      if (reservou.count === 0) continue

      const r = await canal.enviarTemplate({
        paraE164: alvo.membro.telefoneE164,
        template: campanha.templateNome,
        variaveis: [alvo.membro.nome.split(' ')[0] ?? alvo.membro.nome],
      })

      if (r.ok) {
        enviados++

        const conversa = await prisma.conversa.upsert({
          where: {
            id: (await prisma.conversa.findFirst({ where: { membroId: alvo.membroId } }))?.id ?? 'novo',
          },
          update: { ultimaMensagemEm: new Date() },
          create: { membroId: alvo.membroId, ultimaMensagemEm: new Date() },
        })

        await prisma.mensagem.create({
          data: {
            conversaId: conversa.id,
            direcao: 'SAIDA',
            tipo: 'TEMPLATE',
            templateNome: campanha.templateNome,
            providerMessageId: r.providerMessageId ?? null,
            statusEntrega: 'ENVIADO',
            texto: `[template ${campanha.templateNome}]`,
          },
        })
      } else {
        falhas++
        // Erro temporario volta para a fila; erro nosso fica registrado como
        // falha, porque tentar de novo so gastaria template.
        await prisma.campanhaAlvo.update({
          where: { id: alvo.id },
          data: { status: r.reentar ? 'PENDENTE' : 'FALHOU', erro: r.erro ?? null },
        })
      }
    }

    const restam = await prisma.campanhaAlvo.count({
      where: { campanhaId: campanha.id, status: 'PENDENTE' },
    })
    if (restam === 0) {
      await prisma.campanha.update({
        where: { id: campanha.id },
        data: { status: 'CONCLUIDA', concluidaEm: new Date() },
      })
    }
  }

  if (enviados || pulados || falhas) {
    console.log(`disparo: ${enviados} enviados, ${pulados} pulados, ${falhas} falhas`)
  }
}

/**
 * A janela de 24h abre quando o ALUNO responde, não quando a gente manda.
 * Chamado pelo webhook do WhatsApp ao receber mensagem.
 */
export async function registrarRespostaDeCampanha(membroId: string) {
  await prisma.campanhaAlvo.updateMany({
    where: { membroId, status: { in: ['ENVIADO', 'ENTREGUE'] } },
    data: { status: 'RESPONDIDO' },
  })

  const conversa = await prisma.conversa.findFirst({ where: { membroId } })
  if (conversa) {
    await prisma.conversa.update({
      where: { id: conversa.id },
      data: { janelaServicoExpiraEm: calcularFimJanelaServico(new Date()) },
    })
  }
}
