import PgBoss from 'pg-boss'
import { FILAS } from './filas.js'
import { sincronizarMembros } from './jobs/sync-evo.js'
import { dispararMensagem } from './jobs/disparo.js'
import { extrairInsight } from './jobs/extracao.js'
import { verificarAusencias } from './jobs/ausencia.js'
import { parabenizarAniversariantes } from './jobs/aniversario.js'

/**
 * Worker de filas e crons.
 *
 * Usa pg-boss, que roda a fila dentro do proprio Postgres. Um servico a menos
 * no Railway e uma conta a menos no fim do mes. Se o volume crescer a ponto de
 * incomodar, a troca para BullMQ + Redis e local: so este arquivo muda.
 */

const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL,
  // Disparo em massa sem retry perde gente de verdade. Com retry sem backoff,
  // bate na Meta de novo no mesmo segundo e toma 429.
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
})

boss.on('error', (e) => console.error('[pg-boss]', e))

async function main() {
  await boss.start()

  for (const fila of Object.values(FILAS)) {
    await boss.createQueue(fila)
  }

  await boss.work(FILAS.SYNC_EVO, sincronizarMembros)
  await boss.work(FILAS.DISPARO, dispararMensagem)
  await boss.work(FILAS.EXTRACAO, { batchSize: 10 }, extrairInsight)

  // --- crons (horario de Sao Paulo) ---------------------------------------
  // Sync a cada 2 horas. Virou possivel depois que o client passou a puxar a
  // base inteira em UMA requisicao com filtro de "so quem mudou": sao 12
  // chamadas por dia, 360 por mes, dentro dos 1.000 do plano Plus.
  //
  // Isso encurta de 24h para 2h a janela em que alguem que cancelou ainda
  // poderia receber campanha, que era o unico motivo real para querer webhook.
  await boss.schedule(FILAS.SYNC_EVO, '0 */2 * * *', {}, { tz: 'America/Sao_Paulo' })

  // Disparo de minuto em minuto. A vazao sai do relogio, nao de um laco
  // apertado: e o jeito mais simples de respeitar o limite da Meta sem
  // inventar semaforo distribuido. O job checa sozinho se ha campanha ativa.
  await boss.schedule(FILAS.DISPARO, '* * * * *', {}, { tz: 'America/Sao_Paulo' })

  // Ausencia as 10h: quem nao passa na catraca ha 3 dias (CT-070).
  await boss.work(FILAS.AUSENCIA, verificarAusencias)
  await boss.schedule(FILAS.AUSENCIA, '0 10 * * *', {}, { tz: 'America/Sao_Paulo' })

  // Aniversario as 9h (CT-035).
  await boss.work(FILAS.ANIVERSARIO, parabenizarAniversariantes)
  await boss.schedule(FILAS.ANIVERSARIO, '0 9 * * *', {}, { tz: 'America/Sao_Paulo' })

  console.log('worker no ar, filas:', Object.values(FILAS).join(', '))
}

const encerrar = async () => {
  console.log('encerrando worker, esperando jobs em andamento')
  await boss.stop({ graceful: true })
  process.exit(0)
}
process.on('SIGTERM', () => void encerrar())
process.on('SIGINT', () => void encerrar())

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
