/**
 * Diagnóstico da EVO API (CT-010).
 *
 *   npm run evo:testar
 *
 * Responde de uma vez as perguntas que travam a Sprint 1:
 *   - o DNS e a chave estão certos?
 *   - o plano da academia libera API?
 *   - quantos alunos existem e quantos têm celular válido?
 *   - o histórico da catraca vem por consulta ou só por webhook?
 *
 * Lê EVO_DNS e EVO_TOKEN do .env. A chave nunca é impressa.
 */
import 'dotenv/config'
import { EvoClient, EvoError } from '../packages/evo/src/client.js'
import { nomeDoMembro, telefoneDoMembro, type EvoMembro } from '../packages/evo/src/tipos.js'
import { normalizarTelefone } from '../packages/shared/src/telefone.js'

const ok = (t: string) => console.log('  [ok]   ' + t)
const erro = (t: string) => console.log('  [erro] ' + t)
const aviso = (t: string) => console.log('  [!]    ' + t)

async function main() {
  console.log('\nDiagnóstico da EVO API\n' + '='.repeat(60))

  const dns = process.env.EVO_DNS
  const chave = process.env.EVO_TOKEN

  console.log('\n1. Credenciais no .env')
  if (!dns || !chave) {
    erro('EVO_DNS ou EVO_TOKEN está vazio no .env')
    console.log('\n   No painel do EVO: engrenagem > Integração > botão +')
    console.log('   O DNS da academia é o usuário, a chave gerada é a senha.\n')
    process.exit(1)
  }
  ok(`EVO_DNS = ${dns}`)
  ok(`EVO_TOKEN = ${chave.length} caracteres (não vou imprimir)`)

  const evo = new EvoClient()

  console.log('\n2. Conexão')
  const teste = await evo.testarConexao()
  if (!teste.ok) {
    erro(teste.detalhe)
    console.log('\n   Se der 401: confira se o DNS está certo e se o token tem as tags')
    console.log('   de permissão marcadas (Members, Prospects, Access Control).')
    console.log('   Se der 403: o plano da academia pode não liberar API. Abra chamado')
    console.log('   na ABC Evo perguntando qual plano libera e qual o limite mensal.\n')
    process.exit(1)
  }
  ok(teste.detalhe)

  console.log('\n3. Base de alunos')
  const membros: EvoMembro[] = []
  let lotes = 0
  try {
    for await (const lote of evo.listarMembros(50)) {
      membros.push(...lote)
      lotes++
      process.stdout.write(`\r  lendo... ${membros.length} alunos`)
      if (lotes > 200) {
        console.log('\n  (parei em 10 mil para não estourar o limite de requisições)')
        break
      }
    }
    console.log(`\r  ${' '.repeat(40)}\r`)
    ok(`${membros.length} alunos lidos em ${lotes} requisições`)
  } catch (e) {
    erro(`falhou ao listar: ${(e as Error).message}`)
    process.exit(1)
  }

  console.log('\n4. Cobertura de contato (isso decide a primeira campanha)')
  let comCelular = 0
  const problemas: Record<string, number> = {}
  for (const m of membros) {
    const r = normalizarTelefone(telefoneDoMembro(m))
    if (r.valido && r.movel) comCelular++
    else problemas[r.valido ? 'é fixo, não recebe WhatsApp' : r.motivo] =
      (problemas[r.valido ? 'é fixo, não recebe WhatsApp' : r.motivo] ?? 0) + 1
  }
  const cobertura = membros.length ? Math.round((comCelular / membros.length) * 100) : 0
  ok(`${comCelular} de ${membros.length} com celular válido (${cobertura}%)`)

  if (Object.keys(problemas).length) {
    console.log('\n  Por que os outros ficaram de fora:')
    for (const [motivo, n] of Object.entries(problemas).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(n).padStart(5)}  ${motivo}`)
    }
  }
  if (cobertura < 70 && membros.length > 0) {
    aviso(`cobertura abaixo de 70%. A primeira campanha deveria ser de atualização`)
    aviso(`cadastral, não a pesquisa, senão queima template pago entregando pouco.`)
  }

  console.log('\n5. Campos que o EVO devolve (confirma nossos tipos)')
  const exemplo = membros[0]
  if (exemplo) {
    ok(`nome: ${nomeDoMembro(exemplo) ? 'vem preenchido' : 'VAZIO'}`)
    ok(`nascimento: ${exemplo.birthDate ? 'vem preenchido' : 'VAZIO, sem campanha de aniversário'}`)
    ok(`contrato: ${exemplo.contracts?.length ? 'vem preenchido' : 'VAZIO, sem plano nem data de início'}`)
    console.log('\n  Campos disponíveis no primeiro registro:')
    console.log('    ' + Object.keys(exemplo).join(', '))
  }

  console.log('\n6. Catraca (define se o lembrete de ausência é possível)')
  try {
    const ate = new Date()
    const de = new Date(ate.getTime() - 7 * 24 * 60 * 60 * 1000)
    const entradas = await evo.listarEntradas(de, ate)
    ok(`endpoint de entradas responde: ${entradas.length} registros nos últimos 7 dias`)
    if (entradas.length === 0) {
      aviso('respondeu vazio. Pode ser que o histórico só venha por webhook.')
    }
  } catch (e) {
    const err = e as EvoError
    erro(`endpoint de entradas falhou (HTTP ${err.status})`)
    aviso('o CT-016 e o CT-070 dependem disso. Pergunte à ABC Evo se o histórico')
    aviso('da catraca vem por consulta ou só por webhook.')
  }

  console.log('\n7. Prospects')
  try {
    let n = 0
    for await (const lote of evo.listarProspects(50)) {
      n += lote.length
      if (n > 500) break
    }
    ok(`${n} prospects acessíveis`)
  } catch (e) {
    aviso(`prospects indisponível: ${(e as Error).message.slice(0, 80)}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('Diagnóstico terminado. Me mande esta saída inteira.')
  console.log('A chave não aparece em lugar nenhum dela.\n')
}

main().catch((e) => {
  console.error('\nfalhou:', (e as Error).message, '\n')
  process.exit(1)
})
