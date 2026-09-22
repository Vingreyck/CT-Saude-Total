'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Laboratório: converse com o bot como se fosse o aluno.
 *
 * O caminho é o mesmo da conversa real, só não sai para a Meta. Do lado
 * direito aparece o que a conversa já virou dado, que é o ponto do projeto.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://ctapi-production.up.railway.app'

interface Membro {
  id: string
  nome: string
  plano: string | null
  provedorIA: string
  erro?: string
}

interface Insight {
  categoria: string
  subcategoria: string | null
  sentimento: string
  urgencia: string
  entidades: Record<string, string | null> | null
  tags: string[]
}

interface Item {
  pergunta: string
  categoria: string | null
  tipo: string
  valor: string | number | null
  insights: Insight[]
}

interface Estado {
  mensagens: Array<{ de: string; texto: string; em: string }>
  nps: number | null
  status: string | null
  itens: Item[]
}

export default function Laboratorio() {
  const [membro, setMembro] = useState<Membro | null>(null)
  const [estado, setEstado] = useState<Estado | null>(null)
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${API}/lab/membro`)
      .then((r) => r.json())
      .then((m: Membro) => {
        setMembro(m)
        if (m.id) carregar(m.id)
      })
      .catch(() => setErro('não consegui falar com a API'))
  }, [])

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth' })
  }, [estado?.mensagens.length, pensando])

  async function carregar(id: string) {
    const r = await fetch(`${API}/lab/estado/${id}`)
    setEstado(await r.json())
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!membro?.id || !texto.trim() || pensando) return

    const meu = texto.trim()
    setTexto('')
    setErro(null)
    setPensando(true)

    setEstado((s) =>
      s ? { ...s, mensagens: [...s.mensagens, { de: 'aluno', texto: meu, em: '' }] } : s,
    )

    try {
      const r = await fetch(`${API}/lab/mensagem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membroId: membro.id, texto: meu }),
      })
      const d = await r.json()
      if (!r.ok) setErro(d.erro ?? 'falhou')
      await carregar(membro.id)
    } catch {
      setErro('a API não respondeu')
    } finally {
      setPensando(false)
    }
  }

  async function reiniciar() {
    if (!membro?.id) return
    await fetch(`${API}/lab/reiniciar/${membro.id}`, { method: 'POST' })
    await carregar(membro.id)
    setErro(null)
  }

  if (membro?.erro) {
    return (
      <main>
        <div className="aviso">{membro.erro}</div>
      </main>
    )
  }

  const comInsight = estado?.itens.filter((i) => i.insights.length > 0) ?? []

  return (
    <main className="lab">
      <header>
        <div>
          <h1>Laboratório</h1>
          <p>
            Converse como se fosse o aluno{membro ? ` ${membro.nome.split(' ')[0]}` : ''}. O bot
            responde igual responderia no WhatsApp.
          </p>
        </div>
        <div className="cabecalho-acoes">
          {membro && (
            <span className="pilula">
              IA: {membro.provedorIA === 'nenhum' ? 'sem chave' : membro.provedorIA}
            </span>
          )}
          <button onClick={reiniciar} type="button">
            Recomeçar
          </button>
        </div>
      </header>

      {erro && <div className="aviso">{erro}</div>}

      <div className="colunas">
        <section className="chat">
          <div className="fluxo">
            {(estado?.mensagens.length ?? 0) === 0 && (
              <p className="dica">
                Manda um &quot;oi&quot; pra começar. O bot vai te fazer as perguntas da pesquisa.
              </p>
            )}
            {estado?.mensagens.map((m, i) => (
              <div key={i} className={`balao ${m.de}`}>
                {m.texto}
              </div>
            ))}
            {pensando && <div className="balao bot digitando">digitando</div>}
            <div ref={fim} />
          </div>

          <form onSubmit={enviar}>
            <input
              id="campo-mensagem"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="responda como o aluno responderia"
              autoComplete="off"
            />
            <button type="submit" disabled={pensando || !texto.trim()}>
              Enviar
            </button>
          </form>
        </section>

        <aside className="dados">
          <div className="topo-dados">
            <h2>O que já virou dado</h2>
            {estado?.status && <span className="pilula">{estado.status.toLowerCase()}</span>}
          </div>

          {estado?.nps !== null && estado?.nps !== undefined && (
            <div className="nps">
              <span className="n">{estado.nps}</span>
              <span>
                NPS ·{' '}
                {estado.nps >= 9 ? 'promotor' : estado.nps >= 7 ? 'neutro' : 'detrator'}
              </span>
            </div>
          )}

          {(estado?.itens.length ?? 0) === 0 && (
            <p className="dica">Nada ainda. Cada resposta sua aparece aqui na hora.</p>
          )}

          {estado?.itens.map((it, i) => (
            <div key={i} className="registro">
              <span className="rotulo">{it.categoria ?? it.tipo.toLowerCase()}</span>
              <p className="valor">{String(it.valor ?? '')}</p>
              {it.insights.map((s, j) => (
                <div key={j} className="insight">
                  <div className="linha-tags">
                    <span className={`tag s-${s.sentimento.toLowerCase()}`}>
                      {s.sentimento.toLowerCase()}
                    </span>
                    <span className="tag">{s.categoria}</span>
                    {s.subcategoria && <span className="tag">{s.subcategoria}</span>}
                    {s.urgencia !== 'BAIXA' && (
                      <span className="tag urgente">urgência {s.urgencia.toLowerCase()}</span>
                    )}
                  </div>
                  {s.entidades &&
                    Object.entries(s.entidades).filter(([, v]) => v).length > 0 && (
                      <p className="entidades">
                        {Object.entries(s.entidades)
                          .filter(([, v]) => v)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </p>
                    )}
                </div>
              ))}
            </div>
          ))}

          {comInsight.length > 0 && (
            <p className="nota-rodape">
              {comInsight.length} resposta{comInsight.length > 1 ? 's' : ''} em texto livre já
              {comInsight.length > 1 ? ' foram classificadas' : ' foi classificada'} e{' '}
              {comInsight.length > 1 ? 'viraram linhas' : 'virou linha'} que o dono consegue
              filtrar.
            </p>
          )}
        </aside>
      </div>
    </main>
  )
}
