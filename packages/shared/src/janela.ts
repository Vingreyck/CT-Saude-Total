/**
 * Janela de servico do WhatsApp e janela de horario do disparo.
 *
 * Isso aqui e dinheiro: mensagem dentro da janela de 24h aberta pela resposta
 * do aluno e GRATUITA. Fora dela, so template pago (~R$ 0,34 no marketing).
 * Todo o desenho da pesquisa depende de manter a conversa dentro da janela.
 */

const VINTE_E_QUATRO_HORAS = 24 * 60 * 60 * 1000

export function calcularFimJanelaServico(ultimaMensagemDoAluno: Date): Date {
  return new Date(ultimaMensagemDoAluno.getTime() + VINTE_E_QUATRO_HORAS)
}

export function janelaAberta(expiraEm: Date | null | undefined, agora = new Date()): boolean {
  return !!expiraEm && expiraEm.getTime() > agora.getTime()
}

/** Dentro da janela manda texto livre de graca. Fora, precisa de template pago. */
export function precisaTemplate(expiraEm: Date | null | undefined, agora = new Date()): boolean {
  return !janelaAberta(expiraEm, agora)
}

/**
 * Horario permitido de disparo (CT-032). Mandar mensagem de academia as 6h da
 * manha ou as 23h gera opt-out e reclamacao, que queima o numero.
 */
export function dentroDoHorarioPermitido(
  agora = new Date(),
  inicio = process.env.DISPARO_JANELA_INICIO ?? '08:00',
  fim = process.env.DISPARO_JANELA_FIM ?? '20:00',
  timezone = 'America/Sao_Paulo',
): boolean {
  const hhmm = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(agora)

  return hhmm >= inicio && hhmm < fim
}
