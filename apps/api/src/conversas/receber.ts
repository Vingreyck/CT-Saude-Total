import { prisma, type TipoMensagem } from '@ct/db'
import { triar } from '@ct/ai'
import { calcularFimJanelaServico, normalizarTelefone, variantesTelefone } from '@ct/shared'
import type { MensagemRecebida } from '@ct/whatsapp'

/**
 * Entrada de mensagem do WhatsApp (CT-022 + CT-023).
 *
 * Tudo que chega no numero da academia passa por aqui, e a ordem importa:
 *
 * 1. **Grava primeiro.** Antes de decidir qualquer coisa, a mensagem esta no
 *    banco. Se a triagem quebrar, se a IA estiver fora do ar, se o bot estiver
 *    desligado, o que o aluno escreveu continua la. E o dado que o dono quer.
 * 2. **Gravar duas vezes e pior do que nao gravar.** A Meta reenvia o webhook
 *    quando demora a receber o 200, entao a mesma mensagem chega duas, tres
 *    vezes. O id do provedor e unico no banco e resolve isso na origem.
 * 3. **Opt-out vale mesmo com o bot desligado.** E obrigacao da LGPD, nao
 *    funcionalidade do robo. Quem pede para sair, sai do disparo na hora,
 *    tenha ou nao alguem respondendo.
 */

/** O bot so responde sozinho quando isso estiver ligado, de proposito. */
export function botRespondendo(): boolean {
  return (process.env.BOT_RESPONDE ?? 'nao').toLowerCase() === 'sim'
}

const TIPOS: Record<string, TipoMensagem> = {
  texto: 'TEXTO',
  audio: 'AUDIO',
  imagem: 'IMAGEM',
  documento: 'DOCUMENTO',
  interativo: 'INTERATIVO',
}

export interface ResultadoEntrada {
  /** false quando a Meta reenviou uma mensagem que ja estava gravada. */
  novo: boolean
  conversaId: string
  membroId: string | null
  /** Nome do aluno, ou do perfil do WhatsApp quando nao esta na base. */
  quem: string
  triagem?: string
  precisaHumano: boolean
}

/**
 * Acha o aluno pelo numero de quem escreveu.
 *
 * O EVO guarda o telefone do jeito que a atendente digitou e o WhatsApp manda
 * do jeito que a pessoa registrou. As duas formas do nono digito convivem na
 * base de qualquer academia, entao a busca tenta todas.
 */
async function acharMembro(e164: string) {
  return prisma.membro.findFirst({
    where: { telefoneE164: { in: variantesTelefone(e164) } },
    orderBy: { status: 'asc' },
  })
}

/**
 * Acha ou abre a conversa daquele numero.
 *
 * Conversa antiga do laboratorio nasceu so com o membro, sem telefone. Quando
 * o aluno escreve de verdade pela primeira vez, ela e adotada em vez de virar
 * uma segunda thread da mesma pessoa.
 */
async function acharOuAbrirConversa(
  e164: string,
  membroId: string | null,
  nomePerfil: string | undefined,
) {
  const porTelefone = await prisma.conversa.findFirst({
    where: { canal: 'WHATSAPP', telefoneE164: e164 },
  })
  if (porTelefone) return porTelefone

  if (membroId) {
    const doMembro = await prisma.conversa.findFirst({
      where: { membroId, telefoneE164: null },
      orderBy: { criadoEm: 'desc' },
    })
    if (doMembro) {
      return prisma.conversa.update({
        where: { id: doMembro.id },
        data: { telefoneE164: e164, nomeContato: nomePerfil ?? doMembro.nomeContato },
      })
    }
  }

  return prisma.conversa.create({
    data: {
      canal: 'WHATSAPP',
      membroId,
      telefoneE164: e164,
      nomeContato: nomePerfil ?? null,
    },
  })
}

export async function receberMensagem(m: MensagemRecebida): Promise<ResultadoEntrada> {
  const normalizado = normalizarTelefone(m.deE164)
  const e164 = normalizado.valido ? normalizado.e164 : m.deE164

  const membro = await acharMembro(e164)
  const conversa = await acharOuAbrirConversa(e164, membro?.id ?? null, m.nomePerfil)
  const quem = membro?.nome ?? m.nomePerfil ?? e164

  const texto = m.texto ?? null

  // O id do provedor e unico no banco. Se a Meta reenviar o mesmo webhook, o
  // insert falha aqui e a mensagem nao aparece duas vezes na tela.
  try {
    await prisma.mensagem.create({
      data: {
        conversaId: conversa.id,
        direcao: 'ENTRADA',
        tipo: TIPOS[m.tipo] ?? 'TEXTO',
        texto,
        midiaUrl: m.midiaUrl ?? null,
        providerMessageId: m.providerMessageId,
        statusEntrega: 'ENTREGUE',
      },
    })
  } catch {
    return {
      novo: false,
      conversaId: conversa.id,
      membroId: membro?.id ?? null,
      quem,
      precisaHumano: conversa.precisaHumano,
    }
  }

  // A janela de 24h abre com a mensagem do ALUNO, nunca com a nossa. Enquanto
  // ela estiver aberta, responder e de graca.
  await prisma.conversa.update({
    where: { id: conversa.id },
    data: {
      ultimaMensagemEm: m.recebidaEm,
      janelaServicoExpiraEm: calcularFimJanelaServico(m.recebidaEm),
      nomeContato: m.nomePerfil ?? conversa.nomeContato,
      membroId: conversa.membroId ?? membro?.id ?? null,
    },
  })

  if (!texto?.trim()) {
    return {
      novo: true,
      conversaId: conversa.id,
      membroId: membro?.id ?? null,
      quem,
      precisaHumano: conversa.precisaHumano,
    }
  }

  // Triagem deterministica. Roda com o bot ligado ou desligado, porque o que
  // ela decide nao e o que responder, e o que registrar.
  const t = triar(texto)
  let precisaHumano = conversa.precisaHumano

  if (t.acao === 'opt_out' && membro) {
    await prisma.consentimento.upsert({
      where: {
        membroId_canal_finalidade: {
          membroId: membro.id,
          canal: 'WHATSAPP',
          finalidade: 'comunicacao',
        },
      },
      update: { status: 'OPT_OUT', origem: 'pedido do aluno no WhatsApp' },
      create: {
        membroId: membro.id,
        canal: 'WHATSAPP',
        status: 'OPT_OUT',
        finalidade: 'comunicacao',
        origem: 'pedido do aluno no WhatsApp',
        textoAceito: texto,
      },
    })
    await prisma.respostaPesquisa.updateMany({
      where: { membroId: membro.id, status: { in: ['INICIADA', 'PARCIAL'] } },
      data: { status: 'ABANDONADA' },
    })
  }

  if (t.acao === 'chamar_humano' || t.acao === 'opt_out') {
    precisaHumano = true
    await prisma.conversa.update({
      where: { id: conversa.id },
      data: { precisaHumano: true, motivoTriagem: t.motivo ?? null },
    })
  }

  return {
    novo: true,
    conversaId: conversa.id,
    membroId: membro?.id ?? null,
    quem,
    triagem: t.motivo,
    precisaHumano,
  }
}

/**
 * Status de entrega vindo da Meta (CT-033).
 *
 * Duas gravacoes de proposito: o estado atual fica na mensagem, para a tela
 * ler rapido, e cada evento vira linha no historico, porque "entregue as 9h04
 * e lida as 14h" responde perguntas que o estado atual sozinho nao responde.
 */
export async function registrarStatus(
  providerMessageId: string,
  status: 'enviado' | 'entregue' | 'lido' | 'falhou',
  erro?: string,
): Promise<boolean> {
  const mensagem = await prisma.mensagem.findUnique({ where: { providerMessageId } })
  if (!mensagem) return false

  const mapa = {
    enviado: 'ENVIADO',
    entregue: 'ENTREGUE',
    lido: 'LIDO',
    falhou: 'FALHOU',
  } as const
  const novo = mapa[status]

  // Ordem importa: a Meta as vezes manda "entregue" depois de "lido", e voltar
  // atras no status faria a tela mentir.
  const ordem = { PENDENTE: 0, ENVIADO: 1, ENTREGUE: 2, LIDO: 3, FALHOU: 4 } as const
  if (ordem[novo] >= ordem[mensagem.statusEntrega]) {
    await prisma.mensagem.update({
      where: { id: mensagem.id },
      data: { statusEntrega: novo, erro: erro ?? mensagem.erro },
    })
  }

  await prisma.eventoEntrega.create({
    data: { mensagemId: mensagem.id, evento: novo, payload: erro ? { erro } : undefined },
  })

  // Campanha: entregue conta como entregue no painel de resultado.
  if (novo === 'ENTREGUE' || novo === 'FALHOU') {
    const conversa = await prisma.conversa.findUnique({
      where: { id: mensagem.conversaId },
      select: { membroId: true },
    })
    if (conversa?.membroId) {
      await prisma.campanhaAlvo.updateMany({
        where: { membroId: conversa.membroId, status: 'ENVIADO' },
        data: { status: novo === 'ENTREGUE' ? 'ENTREGUE' : 'FALHOU' },
      })
    }
  }

  return true
}
