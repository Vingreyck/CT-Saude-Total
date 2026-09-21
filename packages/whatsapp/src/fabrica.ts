import type { CanalWhatsapp } from './canal.js'
import { CloudApiWhatsapp } from './cloud-api.js'

/**
 * Escolhe o driver por variavel de ambiente.
 *
 * WHATSAPP_DRIVER=oficial   -> Cloud API da Meta (unico permitido em producao)
 * WHATSAPP_DRIVER=evolution -> API nao oficial, SO para desenvolvimento local
 *                              com numero descartavel.
 */
export function criarCanal(): CanalWhatsapp {
  const driver = process.env.WHATSAPP_DRIVER ?? 'oficial'

  if (driver === 'evolution') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'WHATSAPP_DRIVER=evolution em producao. A API nao oficial arrisca banimento permanente do numero. Use oficial.',
      )
    }
    // Implementar em dev quando for necessario testar sem numero verificado.
    throw new Error('driver evolution ainda nao implementado, ver docs/01-arquitetura.md secao 6')
  }

  return new CloudApiWhatsapp()
}
