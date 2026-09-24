import type { FastifyInstance } from 'fastify'
import { prisma } from '@ct/db'
import { EvoClient } from '@ct/evo'
import { estadoDoEspelho, sincronizarComEvo } from '@ct/sync'

/**
 * Conexão com o EVO, vista pelo painel (CT-010 + CT-012).
 *
 * O sync de verdade roda no cron do worker de duas em duas horas. Esta rota
 * existe para o caso humano: alguém cadastrou um aluno agora e quer ver o nome
 * aparecer aqui sem esperar as duas horas.
 *
 * Disparar não segura a requisição até o fim. Ler 3.000 alunos leva mais tempo
 * do que qualquer navegador espera, então a rota devolve na hora e o painel
 * acompanha pelo estado.
 */
export async function rotasEvo(app: FastifyInstance) {
  /** O que o painel mostra: tamanho da base, cobertura e última sincronização. */
  app.get('/estado', async () => {
    const estado = await estadoDoEspelho()
    const configurado = !!process.env.EVO_DNS && !!process.env.EVO_TOKEN
    return { ...estado, configurado }
  })

  /** Confere credencial e conectividade sem baixar nada. Custa 1 requisição. */
  app.get('/testar', async () => {
    if (!process.env.EVO_DNS || !process.env.EVO_TOKEN) {
      return { ok: false, detalhe: 'EVO_DNS ou EVO_TOKEN não está configurado' }
    }
    return new EvoClient().testarConexao()
  })

  /**
   * Sincroniza agora.
   *
   * `completo: true` relê a base inteira. Sem isso, pede ao EVO só quem mudou
   * desde a última vez, que é uma requisição pequena e gasta quase nada de
   * cota.
   */
  app.post('/sincronizar', async (req, reply) => {
    const { completo } = (req.body ?? {}) as { completo?: boolean }

    if (!process.env.EVO_DNS || !process.env.EVO_TOKEN) {
      return reply.code(400).send({ erro: 'EVO_DNS ou EVO_TOKEN não está configurado' })
    }

    const rodando = await prisma.sincronizacaoEvo.count({ where: { terminadaEm: null } })
    if (rodando > 0) {
      return reply.code(409).send({ erro: 'já tem uma sincronização rodando agora' })
    }

    // Solta e devolve. O erro não se perde: fica gravado na linha da
    // sincronização e aparece no estado, que é o que o painel lê.
    void sincronizarComEvo({ completo: !!completo, origem: 'painel' }).catch((e: unknown) => {
      app.log.error({ err: e }, 'sincronizacao manual falhou')
    })

    return {
      ok: true,
      modo: completo ? 'completo' : 'incremental',
      aviso: 'começou. A base inteira leva alguns minutos.',
    }
  })
}
