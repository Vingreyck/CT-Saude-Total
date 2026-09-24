/**
 * Normalizacao de telefone brasileiro para E.164 (CT-013).
 *
 * A base do EVO vem com telefone digitado por gente, em uns oito formatos
 * diferentes. Mandar mensagem para numero mal formatado gasta template pago e
 * volta erro, entao isso roda antes de qualquer disparo e o que nao normalizar
 * fica marcado como invalido e fora do lote.
 */

export type ResultadoTelefone =
  | { valido: true; e164: string; movel: boolean }
  | { valido: false; motivo: string }

const DDDS_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
])

export function normalizarTelefone(bruto: string | null | undefined): ResultadoTelefone {
  if (!bruto) return { valido: false, motivo: 'vazio' }

  let d = bruto.replace(/\D/g, '')

  // remove o 55 do pais, se veio
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)

  // remove 0 de operadora na frente (0xx)
  if (d.length === 12 && d.startsWith('0')) d = d.slice(1)

  if (d.length < 10) return { valido: false, motivo: 'curto demais' }
  if (d.length > 11) return { valido: false, motivo: 'longo demais' }

  const ddd = Number(d.slice(0, 2))
  if (!DDDS_VALIDOS.has(ddd)) return { valido: false, motivo: `DDD ${ddd} nao existe` }

  let numero = d.slice(2)

  // Cadastro antigo com 8 digitos: se comeca em 6-9, e celular que perdeu o
  // nono digito na migracao. Fixo comeca em 2-5 e continua com 8.
  if (numero.length === 8 && /^[6-9]/.test(numero)) {
    numero = '9' + numero
  }

  const movel = numero.length === 9

  if (movel && !numero.startsWith('9')) {
    return { valido: false, motivo: 'celular de 9 digitos deve comecar com 9' }
  }
  if (!movel && !/^[2-5]/.test(numero)) {
    return { valido: false, motivo: 'fixo deve comecar entre 2 e 5' }
  }

  // Um numero com todos os digitos iguais e lixo de cadastro, nao telefone.
  if (/^(\d)\1+$/.test(numero)) return { valido: false, motivo: 'digitos repetidos' }

  return { valido: true, e164: `+55${ddd}${numero}`, movel }
}

/** So celular recebe WhatsApp. Fixo no cadastro nao entra em disparo. */
export function podeReceberWhatsapp(bruto: string | null | undefined): boolean {
  const r = normalizarTelefone(bruto)
  return r.valido && r.movel
}

/**
 * As formas em que o MESMO celular pode estar gravado.
 *
 * O Brasil ganhou o nono digito em 2012 e a base de qualquer academia ficou
 * com os dois formatos convivendo. O WhatsApp manda o numero do jeito que a
 * pessoa registrou, o EVO guarda do jeito que a atendente digitou, e os dois
 * nao batem sempre.
 *
 * Sem isso, o aluno escreve e cai como desconhecido, mesmo estando na base
 * com nome, plano e contrato.
 */
export function variantesTelefone(e164: string): string[] {
  const r = normalizarTelefone(e164)
  if (!r.valido) return [e164]

  const ddd = r.e164.slice(3, 5)
  const numero = r.e164.slice(5)

  const formas = new Set<string>([r.e164, e164])

  if (numero.length === 9 && numero.startsWith('9')) {
    formas.add(`+55${ddd}${numero.slice(1)}`)
  }
  if (numero.length === 8) {
    formas.add(`+55${ddd}9${numero}`)
  }

  return [...formas]
}
