/**
 * Gera uma base de alunos fictícios para desenvolver sem depender do EVO.
 *
 *   npm run base:gerar          cria 400 alunos
 *   npm run base:gerar -- 1200  cria 1200
 *   npm run base:limpar         apaga tudo que foi gerado
 *
 * Duas garantias que importam:
 *
 * 1. Todo registro leva a tag "base-teste". Nada aqui se mistura com aluno de
 *    verdade, e a limpeza é exata.
 * 2. Os telefones são sequenciais a partir de +5511990000000, uma faixa
 *    reservada aqui para teste. O simulador nunca manda nada para fora, mas
 *    mesmo assim não vale a pena gerar número que possa ser de alguém.
 */
import 'dotenv/config'
import { prisma, type StatusMembro } from '../packages/db/src/index.js'

const PRIMEIROS = [
  'Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique',
  'Isabela', 'João', 'Karina', 'Lucas', 'Mariana', 'Nícolas', 'Olívia', 'Pedro',
  'Rafaela', 'Samuel', 'Tatiane', 'Vinícius', 'Wesley', 'Yasmin', 'Rene', 'Camila',
  'Thiago', 'Juliana', 'Matheus', 'Fernanda', 'Rodrigo', 'Patrícia',
]

const SOBRENOMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Almeida',
  'Nascimento', 'Carvalho', 'Araújo', 'Ribeiro', 'Gomes', 'Martins', 'Rocha',
  'Barbosa', 'Alves', 'Monteiro', 'Cardoso', 'Teixeira',
]

const PLANOS = [
  { nome: 'Mensal', peso: 30 },
  { nome: 'Trimestral', peso: 25 },
  { nome: 'Semestral', peso: 25 },
  { nome: 'Anual', peso: 20 },
]

/** Distribuição parecida com a de uma academia de bairro. */
const STATUS: Array<{ v: StatusMembro; peso: number }> = [
  { v: 'ATIVO', peso: 72 },
  { v: 'INATIVO', peso: 16 },
  { v: 'CANCELADO', peso: 8 },
  { v: 'PROSPECT', peso: 4 },
]

function sortear<T>(itens: Array<{ peso: number } & T>): T {
  const total = itens.reduce((s, i) => s + i.peso, 0)
  let n = Math.random() * total
  for (const item of itens) {
    n -= item.peso
    if (n <= 0) return item
  }
  return itens[itens.length - 1]!
}

const umDe = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!

function dataEntre(anosAtras: number, ateAnosAtras = 0): Date {
  const agora = Date.now()
  const ano = 365 * 24 * 60 * 60 * 1000
  return new Date(agora - (ateAnosAtras * ano + Math.random() * (anosAtras - ateAnosAtras) * ano))
}

async function gerar(quantidade: number) {
  const unidade = await prisma.unidade.upsert({
    where: { id: 'unidade-matriz' },
    update: {},
    create: { id: 'unidade-matriz', nome: 'CT Saúde Total' },
  })

  const existentes = await prisma.membro.count({ where: { tags: { has: 'base-teste' } } })
  if (existentes > 0) {
    console.log(`já existem ${existentes} alunos de teste. Rode npm run base:limpar antes.`)
    return
  }

  console.log(`gerando ${quantidade} alunos de teste...`)

  const linhas = []
  for (let i = 0; i < quantidade; i++) {
    const status = sortear(STATUS).v
    const nome = `${umDe(PRIMEIROS)} ${umDe(SOBRENOMES)}`

    // 8% sem celular valido, que e mais ou menos o que uma base real tem.
    // O relatorio de cobertura precisa ter com o que se preocupar.
    const semTelefone = Math.random() < 0.08

    linhas.push({
      unidadeId: unidade.id,
      idEvo: 900000 + i,
      nome,
      telefoneE164: semTelefone ? null : `+55119${String(90000000 + i).slice(0, 8)}`,
      telefoneValido: !semTelefone,
      email: `${nome.toLowerCase().replace(/[^a-z]/g, '.')}@exemplo.teste`,
      nascimento: dataEntre(55, 18),
      status,
      plano: status === 'PROSPECT' ? null : sortear(PLANOS).nome,
      inicioContrato: status === 'PROSPECT' ? null : dataEntre(3),
      sincronizadoEm: new Date(),
      tags: ['base-teste'],
    })
  }

  const r = await prisma.membro.createMany({ data: linhas, skipDuplicates: true })

  const ativos = await prisma.membro.count({ where: { tags: { has: 'base-teste' }, status: 'ATIVO' } })
  const comZap = await prisma.membro.count({
    where: { tags: { has: 'base-teste' }, status: 'ATIVO', telefoneValido: true },
  })

  console.log(`\n${r.count} alunos criados`)
  console.log(`${ativos} ativos, ${comZap} com celular válido`)
  console.log(`cobertura de contato: ${Math.round((comZap / ativos) * 100)}%`)
  console.log('\nabra o painel, os números já estão lá.\n')
}

async function limpar() {
  const r = await prisma.membro.deleteMany({ where: { tags: { has: 'base-teste' } } })
  console.log(`${r.count} alunos de teste apagados. Nenhum aluno real foi tocado.`)
}

const comando = process.argv[2]
const acao = comando === 'limpar' ? limpar() : gerar(Number(comando) || 400)

acao
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
