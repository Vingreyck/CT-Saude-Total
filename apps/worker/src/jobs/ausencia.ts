import type { Job } from 'pg-boss'

/**
 * Quem nao passa na catraca ha 3 dias recebe mensagem (CT-070).
 *
 * Template classificado como utility (~R$ 0,04), nao marketing (~R$ 0,34).
 * Uma mensagem por periodo de ausencia, nunca duas.
 */
export async function verificarAusencias(_jobs: Job[]) {
  console.log('TODO CT-070: depende do historico de catraca (CT-016)')
}
