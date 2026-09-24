import { prisma } from '@ct/db'

export const dynamic = 'force-dynamic'

/**
 * Home do painel (CT-060).
 *
 * Esqueleto: os numeros ja vem do banco de verdade, as telas de dentro sao da
 * Sprint 1 e 3. A ideia e que o dono abra isto e entenda a academia em 5
 * segundos, sem pedir relatorio para ninguem.
 */

interface Numeros {
  ativos: number
  comContato: number
  respostas: number
  nps: number | null
  alertas: number
  erro?: string
}

async function carregar(): Promise<Numeros> {
  try {
    const [ativos, comContato, respostas, notas] = await Promise.all([
      prisma.membro.count({ where: { status: 'ATIVO' } }),
      prisma.membro.count({ where: { status: 'ATIVO', telefoneValido: true } }),
      prisma.respostaPesquisa.count({ where: { status: 'CONCLUIDA' } }),
      prisma.respostaPesquisa.findMany({
        where: { nps: { not: null } },
        select: { nps: true },
      }),
    ])

    const alertas = await prisma.insight.count({ where: { urgencia: 'ALTA' } })

    // NPS = % promotores (9 e 10) menos % detratores (0 a 6).
    let nps: number | null = null
    if (notas.length > 0) {
      const prom = notas.filter((n) => (n.nps ?? 0) >= 9).length
      const detr = notas.filter((n) => (n.nps ?? 0) <= 6).length
      nps = Math.round(((prom - detr) / notas.length) * 100)
    }

    return { ativos, comContato, respostas, nps, alertas }
  } catch (e) {
    return {
      ativos: 0,
      comContato: 0,
      respostas: 0,
      nps: null,
      alertas: 0,
      erro: (e as Error).message,
    }
  }
}

function Cartao({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="cartao">
      <span className="rotulo">{rotulo}</span>
      <strong className="valor">{valor}</strong>
      {nota && <span className="nota">{nota}</span>}
    </div>
  )
}

export default async function Home() {
  const n = await carregar()
  const cobertura = n.ativos > 0 ? Math.round((n.comContato / n.ativos) * 100) : 0

  return (
    <main>
      <header>
        <h1>CT Saúde Total</h1>
        <p>Painel do dono</p>
      </header>

      {n.erro && (
        <div className="aviso">
          Banco ainda não respondeu. Rode <code>npm run db:migrate</code> e confira a
          <code> DATABASE_URL</code>.
        </div>
      )}

      <section className="grade">
        <Cartao rotulo="Alunos ativos" valor={String(n.ativos)} />
        <Cartao
          rotulo="Com WhatsApp válido"
          valor={String(n.comContato)}
          nota={`${cobertura}% de cobertura`}
        />
        <Cartao rotulo="Respostas coletadas" valor={String(n.respostas)} />
        <Cartao rotulo="NPS" valor={n.nps === null ? 'sem dado' : String(n.nps)} />
        <Cartao rotulo="Alertas críticos" valor={String(n.alertas)} />
      </section>

      <section style={{ marginBottom: 32 }}>
        <a
          href="/laboratorio"
          style={{
            display: 'inline-block', padding: '11px 16px', borderRadius: 10,
            background: 'var(--destaque)', color: '#08140d', fontWeight: 600,
            textDecoration: 'none', fontSize: 14,
          }}
        >
          Abrir o laboratório e conversar com o bot
        </a>
        {' '}
        <a
          href="/conversas"
          style={{
            display: 'inline-block', padding: '11px 16px', borderRadius: 10,
            background: 'var(--superficie)', border: '1px solid var(--borda)',
            color: 'var(--texto)', fontWeight: 600, textDecoration: 'none', fontSize: 14,
            marginLeft: 8,
          }}
        >
          Ver todas as conversas
        </a>
        {' '}
        <a
          href="/campanhas"
          style={{
            display: 'inline-block', padding: '11px 16px', borderRadius: 10,
            background: 'var(--superficie)', border: '1px solid var(--borda)',
            color: 'var(--texto)', fontWeight: 600, textDecoration: 'none', fontSize: 14,
            marginLeft: 8,
          }}
        >
          Campanhas
        </a>
        <p style={{ color: 'var(--suave)', fontSize: 13, marginTop: 8 }}>
          Fale como se fosse o aluno e veja a conversa virar dado estruturado, sem WhatsApp.
        </p>
      </section>

      <section className="proximas">
        <h2>Próximas telas</h2>
        <ul>
          <li>Clientes, com busca e filtro (CT-061, Sprint 1)</li>
          <li>Conversas do WhatsApp (CT-063, Sprint 1)</li>
          <li>Ficha do cliente (CT-062, Sprint 3)</li>
          <li>Respostas da pesquisa consolidadas (CT-064, Sprint 3)</li>
          <li>Resultado das campanhas (CT-033, Sprint 3)</li>
        </ul>
      </section>
    </main>
  )
}
