export const FILAS = {
  SYNC_EVO: 'sync-evo',
  DISPARO: 'disparo',
  EXTRACAO: 'extracao',
  AUSENCIA: 'ausencia',
  ANIVERSARIO: 'aniversario',
} as const

export interface JobDisparo {
  campanhaAlvoId: string
  /** campanha_id:membro_id. Sem isso, reprocessar a fila reenvia. */
  chaveIdempotencia: string
}

export interface JobExtracao {
  origem: 'MENSAGEM' | 'RESPOSTA_ITEM'
  id: string
  texto: string
}
