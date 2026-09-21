import type { Job } from 'pg-boss'
import type { JobExtracao } from '../filas.js'

/**
 * Transforma texto livre em linha consultavel (CT-053). O diamante do projeto.
 *
 * Roda em lote e fora do caminho da conversa: a resposta ao aluno nao pode
 * esperar a extracao terminar.
 */
export async function extrairInsight(jobs: Job<JobExtracao>[]) {
  for (const job of jobs) {
    console.log('TODO CT-053: extrair de', job.data.origem, job.data.id)
  }
}
