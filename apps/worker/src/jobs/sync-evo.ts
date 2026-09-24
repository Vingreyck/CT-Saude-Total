import type { Job } from 'pg-boss'
import { sincronizarComEvo } from '@ct/sync'

/**
 * Cron do espelho do EVO (CT-012).
 *
 * A rotina de verdade mora em @ct/sync, porque o painel tambem a dispara pelo
 * botao "sincronizar agora". Aqui fica so o gatilho do horario.
 *
 * Um job com { completo: true } forca reler a base inteira, para a carga
 * inicial ou quando algo divergir.
 */
export async function sincronizarMembros(jobs: Job<{ completo?: boolean }>[]) {
  const completo = jobs.some((j) => j.data?.completo)
  await sincronizarComEvo({ completo, origem: 'cron' })
}
