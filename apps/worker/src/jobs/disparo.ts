import type { Job } from 'pg-boss'
import type { JobDisparo } from '../filas.js'

/**
 * Envia uma mensagem de campanha (CT-031).
 *
 * As tres travas que nao podem sair daqui:
 *  1. idempotencia: ja enviado nunca reenvia
 *  2. opt-out: consultado no banco, no momento do envio, nao na montagem do lote
 *  3. janela de horario: nada fora de 08:00-20:00
 */
export async function dispararMensagem(jobs: Job<JobDisparo>[]) {
  for (const job of jobs) {
    console.log('TODO CT-031: disparar', job.data.chaveIdempotencia)
  }
}
