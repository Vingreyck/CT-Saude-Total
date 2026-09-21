import type { Job } from 'pg-boss'
import { prisma } from '@ct/db'
import { EvoClient, mapearStatus, nomeDoMembro, telefoneDoMembro } from '@ct/evo'
import { normalizarTelefone } from '@ct/shared'

/**
 * Espelha a base do EVO (CT-012 + CT-013 + CT-014).
 *
 * O EVO e a fonte da verdade cadastral e sempre ganha em caso de divergencia.
 * Mas o sync NUNCA encosta nos campos que sao nossos (tags, objetivo, como
 * conheceu), senao a cada madrugada o trabalho de coleta e apagado.
 */
export async function sincronizarMembros(_jobs: Job[]) {
  const evo = new EvoClient()
  const unidade = await prisma.unidade.findFirstOrThrow()

  let criados = 0
  let atualizados = 0
  let semTelefone = 0

  for await (const lote of evo.listarMembros()) {
    for (const m of lote) {
      const tel = normalizarTelefone(telefoneDoMembro(m))
      if (!tel.valido || !tel.movel) semTelefone++

      const espelho = {
        nome: nomeDoMembro(m),
        telefoneE164: tel.valido ? tel.e164 : null,
        telefoneValido: tel.valido && tel.movel,
        email: m.email ?? null,
        nascimento: m.birthDate ? new Date(m.birthDate) : null,
        status: mapearStatus(m.status ?? m.membershipStatus),
        plano: m.contracts?.[0]?.name ?? null,
        inicioContrato: m.contracts?.[0]?.startDate ? new Date(m.contracts[0].startDate) : null,
        sincronizadoEm: new Date(),
        payloadEvo: m as object,
      }

      const existente = await prisma.membro.findUnique({ where: { idEvo: m.idMember } })

      if (existente) {
        // update so com os campos do espelho. Os nossos ficam intocados.
        await prisma.membro.update({ where: { idEvo: m.idMember }, data: espelho })
        atualizados++
      } else {
        await prisma.membro.create({
          data: { ...espelho, idEvo: m.idMember, unidadeId: unidade.id },
        })
        criados++
      }
    }
  }

  const total = criados + atualizados
  const cobertura = total > 0 ? Math.round(((total - semTelefone) / total) * 100) : 0

  console.log(
    `sync evo: ${criados} criados, ${atualizados} atualizados, ` +
      `${semTelefone} sem celular valido, cobertura de contato ${cobertura}%`,
  )

  // Abaixo de 70%, a primeira campanha nao deve ser a pesquisa: tem que ser
  // atualizacao cadastral, senao o disparo entrega pouco e queima template pago.
  if (cobertura < 70 && total > 0) {
    console.warn(`ATENCAO: cobertura de contato em ${cobertura}%. Ver docs/03-sprints.md, Sprint 1.`)
  }
}
