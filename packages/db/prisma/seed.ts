/**
 * Seed inicial: cria a unidade, um usuario ADM e a Pesquisa de Satisfacao v1
 * ja no formato de conversa (nucleo de 6 + 8 itens rotativos).
 *
 * Conteudo baseado no formulario que o dono gostou (RN Movement), com todo o
 * texto reescrito para CT Saude Total. Ver docs/06-pesquisa-satisfacao.md.
 *
 *   npm run db:seed
 */
import { PrismaClient, TipoPergunta } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const unidade = await prisma.unidade.upsert({
    where: { id: 'unidade-matriz' },
    update: {},
    create: { id: 'unidade-matriz', nome: 'CT Saúde Total' },
  })

  await prisma.usuarioInterno.upsert({
    where: { email: 'adm@ctsaudetotal.com.br' },
    update: {},
    create: {
      unidadeId: unidade.id,
      nome: 'Administrador',
      email: 'adm@ctsaudetotal.com.br',
      funcao: 'ADM',
    },
  })

  const pesquisa = await prisma.pesquisa.upsert({
    where: { nome_versao: { nome: 'Satisfação', versao: 1 } },
    update: {},
    create: { nome: 'Satisfação', versao: 1, ativa: true },
  })

  // --- nucleo: todo mundo responde -----------------------------------------
  const nucleo = [
    {
      ordem: 1,
      tipo: TipoPergunta.ESCALA_NPS,
      enunciado: 'de 0 a 10, quanto você indicaria o CT pra um amigo seu?',
      minimo: 0,
      maximo: 10,
      categoria: 'nps',
    },
    {
      ordem: 2,
      tipo: TipoPergunta.TEXTO,
      enunciado: 'o que te fez dar essa nota?',
      categoria: 'nps_motivo',
    },
    {
      ordem: 20,
      tipo: TipoPergunta.TEXTO,
      enunciado: 'se você pudesse mudar uma coisa só aqui, qual seria?',
      categoria: 'melhoria',
    },
    {
      ordem: 21,
      tipo: TipoPergunta.TEXTO,
      enunciado: 'quer deixar um elogio pra alguém da equipe?',
      obrigatoria: false,
      categoria: 'elogio',
    },
  ]

  // --- rodizio: 2 destes 8 por aluno ---------------------------------------
  const itensNota = [
    ['atendimento_recepcao', 'o atendimento da recepção, de 1 a 5?'],
    ['professores', 'a atenção dos professores durante o treino, de 1 a 5?'],
    ['limpeza', 'e a limpeza da academia, de 1 a 5?'],
    ['equipamentos', 'a organização dos equipamentos, de 1 a 5?'],
    ['climatizacao', 'a climatização do ambiente, de 1 a 5?'],
    ['horarios', 'os horários de funcionamento, de 1 a 5?'],
    ['aulas_coletivas', 'as aulas coletivas, de 1 a 5?'],
    ['custo_beneficio', 'o custo-benefício do plano, de 1 a 5?'],
  ] as const

  const rotativas = itensNota.map(([categoria, enunciado], i) => ({
    ordem: 10 + i,
    tipo: TipoPergunta.NOTA,
    enunciado,
    minimo: 1,
    maximo: 5,
    rotativa: true,
    categoria,
  }))

  for (const p of [...nucleo, ...rotativas]) {
    await prisma.pergunta.upsert({
      where: { pesquisaId_ordem: { pesquisaId: pesquisa.id, ordem: p.ordem } },
      update: {},
      create: { pesquisaId: pesquisa.id, ...p },
    })
  }

  const total = await prisma.pergunta.count({ where: { pesquisaId: pesquisa.id } })
  console.log(`seed ok: unidade, ADM e pesquisa "${pesquisa.nome}" v${pesquisa.versao} com ${total} perguntas`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
