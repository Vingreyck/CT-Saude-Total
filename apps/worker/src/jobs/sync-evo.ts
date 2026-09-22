import type { Job } from 'pg-boss'
import { prisma } from '@ct/db'
import { EvoClient, contratoAtual, mapearStatus, nomeDoMembro, telefonesDoMembro } from '@ct/evo'
import { normalizarTelefone, type ResultadoTelefone } from '@ct/shared'

/**
 * Espelha a base do EVO (CT-012 + CT-013 + CT-014).
 *
 * O EVO e a fonte da verdade cadastral e sempre ganha em caso de divergencia.
 * Mas o sync NUNCA encosta nos campos que sao nossos (tags, objetivo, como
 * conheceu), senao a cada madrugada o trabalho de coleta e apagado.
 */
export async function sincronizarMembros(jobs: Job<{ completo?: boolean }>[]) {
  const evo = new EvoClient()

  // Sync incremental: pede so quem mudou desde a ultima sincronizacao. Um job
  // com { completo: true } forca reler a base inteira, para a carga inicial ou
  // quando algo divergir.
  const completo = jobs.some((j) => j.data?.completo)
  const ultimo = completo
    ? null
    : await prisma.membro.aggregate({ _max: { sincronizadoEm: true } })
  const desde = ultimo?._max.sincronizadoEm
    ? new Date(ultimo._max.sincronizadoEm.getTime() - 24 * 60 * 60 * 1000)
    : undefined
  const unidade = await prisma.unidade.findFirstOrThrow()

  let criados = 0
  let atualizados = 0
  let semTelefone = 0

  for await (const lote of evo.listarMembros({ desde })) {
    for (const m of lote) {
      // O aluno pode ter varios contatos cadastrados. Vale o primeiro que
      // normaliza para celular valido, nao o primeiro da lista.
      const tel = telefonesDoMembro(m)
        .map(normalizarTelefone)
        .find((r): r is Extract<ResultadoTelefone, { valido: true }> => r.valido && r.movel)
      if (!tel) semTelefone++

      const contrato = contratoAtual(m)

      const espelho = {
        nome: nomeDoMembro(m),
        telefoneE164: tel ? tel.e164 : null,
        telefoneValido: !!tel,
        nascimento: m.birthDate ? new Date(m.birthDate) : null,
        status: mapearStatus(m.status ?? m.membershipStatus),
        plano: contrato?.name ?? null,
        inicioContrato: contrato?.startDate ? new Date(contrato.startDate) : null,
        fimContrato: contrato?.endDate ? new Date(contrato.endDate) : null,
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
    `sync evo (${desde ? 'incremental desde ' + desde.toISOString().slice(0, 10) : 'completo'}): ` +
      `${criados} criados, ${atualizados} atualizados, ` +
      `${semTelefone} sem celular valido, cobertura de contato ${cobertura}%`,
  )

  // Abaixo de 70%, a primeira campanha nao deve ser a pesquisa: tem que ser
  // atualizacao cadastral, senao o disparo entrega pouco e queima template pago.
  if (cobertura < 70 && total > 0) {
    console.warn(`ATENCAO: cobertura de contato em ${cobertura}%. Ver docs/03-sprints.md, Sprint 1.`)
  }
}
