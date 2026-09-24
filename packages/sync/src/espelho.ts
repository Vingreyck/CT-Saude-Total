import { prisma } from '@ct/db'
import {
  EvoClient,
  contratoAtual,
  emailDoMembro,
  mapearStatus,
  nomeDoMembro,
  telefonesDoMembro,
  ultimoAcesso,
} from '@ct/evo'
import { normalizarTelefone, type ResultadoTelefone } from '@ct/shared'

/**
 * Espelho da base do EVO (CT-012 + CT-013 + CT-014).
 *
 * Mora num pacote proprio porque quem dispara isto e de dois lugares: o cron
 * do worker, de duas em duas horas, e o botao do painel, quando o dono quer
 * agora. Duplicar a rotina seria garantir que uma das duas ficaria para tras.
 *
 * Duas regras que nao mudam:
 *
 * 1. **O EVO ganha no cadastral.** Nome, telefone, plano e status vem de la e
 *    sobrescrevem o que estiver aqui.
 * 2. **O sync nunca encosta no que e nosso.** Tags, objetivo, como conheceu,
 *    consentimento e conversa ficam intocados. Se isso vazar uma vez, a coleta
 *    de meses vira zero numa madrugada.
 */

/** Quantos updates saem ao mesmo tempo. Acima disso a pool comeca a esperar. */
const EM_PARALELO = 10

/** Depois disso, uma sincronizacao sem fim registrado e considerada morta. */
const MINUTOS_ATE_DESISTIR = 30

export type OrigemSync = 'cron' | 'painel' | 'script'

export interface RelatorioSync {
  rodou: boolean
  motivo?: string
  modo: 'completo' | 'incremental'
  lidos: number
  criados: number
  atualizados: number
  semTelefone: number
  cobertura: number
  duracaoMs: number
}

/**
 * Desde quando pedir ao EVO.
 *
 * Vem do historico de sincronizacao, nao do maior `sincronizadoEm` da tabela
 * de membros. Parece a mesma coisa e nao e: qualquer linha criada por script
 * de teste carrega `sincronizadoEm` preenchido e faria o sync achar que a base
 * ja esta em dia, pulando a carga inicial inteira.
 *
 * As 24 horas de folga cobrem fuso e relogio fora de hora dos dois lados.
 */
async function desdeQuando(): Promise<Date | undefined> {
  const ultima = await prisma.sincronizacaoEvo.findFirst({
    where: { terminadaEm: { not: null }, erro: null },
    orderBy: { terminadaEm: 'desc' },
  })
  if (!ultima?.terminadaEm) return undefined
  return new Date(ultima.terminadaEm.getTime() - 24 * 60 * 60 * 1000)
}

async function unidadePadrao(): Promise<string> {
  const existente = await prisma.unidade.findFirst()
  if (existente) return existente.id
  const nova = await prisma.unidade.create({ data: { nome: 'CT Saúde Total' } })
  return nova.id
}

/** Roda em pedacos para nao abrir 3.000 conexoes de uma vez. */
async function emLotes<T>(itens: T[], tamanho: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < itens.length; i += tamanho) {
    await Promise.all(itens.slice(i, i + tamanho).map(fn))
  }
}

export async function sincronizarComEvo(
  opcoes: { completo?: boolean; origem?: OrigemSync } = {},
): Promise<RelatorioSync> {
  const origem = opcoes.origem ?? 'cron'
  const comeco = Date.now()

  // Antes de tudo, encerra o que ficou aberto de um processo que morreu no
  // meio. Sem isso a trava abaixo bloquearia todas as proximas para sempre.
  await prisma.sincronizacaoEvo.updateMany({
    where: {
      terminadaEm: null,
      iniciadaEm: { lt: new Date(Date.now() - MINUTOS_ATE_DESISTIR * 60 * 1000) },
    },
    data: {
      terminadaEm: new Date(),
      erro: 'interrompida no meio: o processo caiu ou reiniciou',
    },
  })

  const desde = opcoes.completo ? undefined : await desdeQuando()
  const modo = desde ? 'incremental' : 'completo'

  // A trava e o indice unico parcial no banco: so existe uma linha sem fim
  // registrado. O cron do worker e o botao do painel rodam em processos
  // diferentes, entao uma variavel em memoria nao veria o outro, e duas
  // leituras simultaneas queimariam cota do EVO a toa.
  let registro
  try {
    registro = await prisma.sincronizacaoEvo.create({ data: { modo, origem } })
  } catch (e) {
    // So a violacao da trava vira recusa educada. Banco fora do ar tem que
    // estourar, senao o painel diria "ja esta rodando" para sempre.
    if ((e as { code?: string })?.code !== 'P2002') throw e
    return {
      rodou: false,
      motivo: 'ja tem uma sincronizacao rodando agora',
      modo,
      lidos: 0,
      criados: 0,
      atualizados: 0,
      semTelefone: 0,
      cobertura: 0,
      duracaoMs: Date.now() - comeco,
    }
  }

  let lidos = 0
  let criados = 0
  let atualizados = 0
  let semTelefone = 0

  try {
    const evo = new EvoClient()
    const unidadeId = await unidadePadrao()

    for await (const lote of evo.listarMembros({ desde })) {
      lidos += lote.length

      // Quem ja existe aqui, numa consulta so por lote. Saber disso antes
      // evita um SELECT por aluno e ainda da a contagem honesta de quantos
      // sao novos de verdade.
      const ids = lote.map((m) => m.idMember)
      const existentes = await prisma.membro.findMany({
        where: { idEvo: { in: ids } },
        select: { idEvo: true },
      })
      const jaTem = new Set(existentes.map((e) => e.idEvo))

      const novos: Array<Record<string, unknown>> = []
      const paraAtualizar: Array<{ idEvo: number; dados: Record<string, unknown> }> = []

      for (const m of lote) {
        // O aluno pode ter varios contatos cadastrados. Vale o primeiro que
        // normaliza para celular valido, nao o primeiro da lista.
        const tel = telefonesDoMembro(m)
          .map(normalizarTelefone)
          .find((r): r is Extract<ResultadoTelefone, { valido: true }> => r.valido && r.movel)
        if (!tel) semTelefone++

        const contrato = contratoAtual(m)

        // O EVO so diz "Active" ou "Inactive" no membro: quem cancelou vem
        // como inativo igual a quem so deixou vencer. A diferenca esta no
        // contrato, que guarda a data de cancelamento, e ela importa porque
        // campanha de retorno para quem cancelou tem outro tom.
        const doEvo = mapearStatus(m.status ?? m.membershipStatus)
        const status = doEvo !== 'ATIVO' && contrato?.cancelDate ? 'CANCELADO' : doEvo

        const espelho = {
          nome: nomeDoMembro(m),
          telefoneE164: tel ? tel.e164 : null,
          telefoneValido: !!tel,
          email: emailDoMembro(m),
          nascimento: m.birthDate ? new Date(m.birthDate) : null,
          status,
          plano: contrato?.name ?? null,
          inicioContrato: contrato?.startDate ? new Date(contrato.startDate) : null,
          fimContrato: contrato?.endDate ? new Date(contrato.endDate) : null,
          ultimoAcessoEm: ultimoAcesso(m),
          sincronizadoEm: new Date(),
          payloadEvo: m as object,
        }

        if (jaTem.has(m.idMember)) {
          paraAtualizar.push({ idEvo: m.idMember, dados: espelho })
        } else {
          novos.push({ ...espelho, idEvo: m.idMember, unidadeId })
        }
      }

      if (novos.length > 0) {
        const r = await prisma.membro.createMany({
          data: novos as never,
          skipDuplicates: true,
        })
        criados += r.count
      }

      await emLotes(paraAtualizar, EM_PARALELO, async (item) => {
        await prisma.membro.update({
          where: { idEvo: item.idEvo },
          data: item.dados as never,
        })
        atualizados++
      })
    }

    const cobertura = lidos > 0 ? Math.round(((lidos - semTelefone) / lidos) * 100) : 0

    await prisma.sincronizacaoEvo.update({
      where: { id: registro.id },
      data: { terminadaEm: new Date(), lidos, criados, atualizados, semTelefone },
    })

    console.log(
      `sync evo (${modo}, ${origem}): ${lidos} lidos, ${criados} criados, ` +
        `${atualizados} atualizados, ${semTelefone} sem celular valido, ` +
        `cobertura de contato ${cobertura}%`,
    )

    // Abaixo de 70%, a primeira campanha nao deve ser a pesquisa: tem que ser
    // atualizacao cadastral, senao o disparo entrega pouco e queima template.
    if (cobertura < 70 && lidos > 0) {
      console.warn(`ATENCAO: cobertura de contato em ${cobertura}%. Ver docs/03-sprints.md.`)
    }

    return {
      rodou: true,
      modo,
      lidos,
      criados,
      atualizados,
      semTelefone,
      cobertura,
      duracaoMs: Date.now() - comeco,
    }
  } catch (e) {
    // O erro fica gravado na linha da sincronizacao. Sem isso, o painel diria
    // "nunca sincronizou" e ninguem saberia que ela tentou e quebrou.
    await prisma.sincronizacaoEvo.update({
      where: { id: registro.id },
      data: {
        terminadaEm: new Date(),
        erro: (e as Error).message.slice(0, 500),
        lidos,
        criados,
        atualizados,
        semTelefone,
      },
    })
    throw e
  }
}

/** O que o painel mostra sobre a conexao com o EVO. */
export async function estadoDoEspelho() {
  const [total, ativos, comContato, ultima, rodando] = await Promise.all([
    prisma.membro.count(),
    prisma.membro.count({ where: { status: 'ATIVO' } }),
    prisma.membro.count({ where: { status: 'ATIVO', telefoneValido: true } }),
    prisma.sincronizacaoEvo.findFirst({
      where: { terminadaEm: { not: null } },
      orderBy: { terminadaEm: 'desc' },
    }),
    prisma.sincronizacaoEvo.count({ where: { terminadaEm: null } }),
  ])

  return {
    total,
    ativos,
    comContato,
    cobertura: ativos > 0 ? Math.round((comContato / ativos) * 100) : 0,
    sincronizando: rodando > 0,
    ultima: ultima
      ? {
          em: ultima.terminadaEm,
          modo: ultima.modo,
          origem: ultima.origem,
          lidos: ultima.lidos,
          criados: ultima.criados,
          atualizados: ultima.atualizados,
          erro: ultima.erro,
        }
      : null,
  }
}
