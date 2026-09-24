import { prisma } from '@ct/db'
import { criarCanal } from '@ct/whatsapp'
import { janelaAberta } from '@ct/shared'
import { processarMensagem } from '../pesquisa/motor.js'
import type { ResultadoEntrada } from './receber.js'

/**
 * Saida de mensagem: o unico lugar que fala com o WhatsApp numa conversa.
 *
 * Tanto o bot quanto a atendente passam por aqui, e por um motivo: a checagem
 * da janela de 24h e o registro do id do provedor precisam acontecer sempre,
 * e duas portas de saida viravam duas versoes dessa regra.
 */

export interface ResultadoSaida {
  ok: boolean
  /** false quando so ficou gravado aqui, sem sair para o WhatsApp. */
  entregue: boolean
  erro?: string
}

/**
 * Manda uma linha ja gravada para o WhatsApp e anota o id do provedor.
 *
 * Conversa de laboratorio nao tem telefone: ali a mensagem fica so no banco,
 * que e exatamente o que o simulador precisa.
 */
export async function entregarMensagem(mensagemId: string): Promise<ResultadoSaida> {
  const mensagem = await prisma.mensagem.findUnique({
    where: { id: mensagemId },
    include: { conversa: true },
  })
  if (!mensagem) return { ok: false, entregue: false, erro: 'mensagem não encontrada' }

  const telefone = mensagem.conversa.telefoneE164
  if (!telefone) return { ok: true, entregue: false }

  if (!janelaAberta(mensagem.conversa.janelaServicoExpiraEm)) {
    return {
      ok: false,
      entregue: false,
      erro: 'a janela de 24h fechou. Só dá para reabrir com um template pago.',
    }
  }

  const canal = criarCanal()
  const r = await canal.enviarTexto({ paraE164: telefone, texto: mensagem.texto ?? '' })

  await prisma.mensagem.update({
    where: { id: mensagem.id },
    data: {
      providerMessageId: r.providerMessageId ?? null,
      statusEntrega: r.ok ? 'ENVIADO' : 'FALHOU',
      erro: r.erro ?? null,
    },
  })

  return { ok: r.ok, entregue: r.ok, erro: r.erro }
}

/**
 * O turno do bot, quando ele estiver ligado.
 *
 * Duas recusas de proposito:
 *
 * 1. **Numero que nao esta na base.** A pesquisa e sobre plano, contrato e
 *    experiencia na academia. Conduzir isso com quem nunca entrou la seria
 *    constrangedor, e e justamente o caso que merece gente respondendo.
 * 2. **Conversa com a equipe.** Se alguem assumiu, o bot se cala. Mandar
 *    pergunta por cima da atendente acontece na frente do aluno.
 */
export async function responderComBot(entrada: ResultadoEntrada, texto: string): Promise<void> {
  if (!entrada.membroId || !texto.trim()) return

  const conversa = await prisma.conversa.findUnique({ where: { id: entrada.conversaId } })
  if (conversa?.assumidaPorId) return

  const turno = await processarMensagem(entrada.membroId, texto, { jaGravada: true })

  for (const id of turno.idsSaida) {
    await entregarMensagem(id)
  }
}
