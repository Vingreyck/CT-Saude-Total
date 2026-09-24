'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Caixa de entrada: todas as conversas ao vivo.
 *
 * A lista recarrega a cada 3 segundos e a conversa aberta a cada 2. É
 * sondagem, não SSE, pela razão explicada em apps/api/src/rotas/conversas.ts.
 *
 * O que a atendente digita não é descartado quando a atualização chega: o
 * campo de texto vive em estado separado do que vem do servidor.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://ctapi-production.up.railway.app'

interface ItemLista {
  id: string
  membro: { id: string; nome: string; plano: string | null; status: string } | null
  contato: { nome: string; telefone: string | null; naBase: boolean }
  origem: 'whatsapp' | 'laboratorio'
  precisaHumano: boolean
  motivoTriagem: string | null
  assumida: boolean
  semResposta: boolean
  janelaAberta: boolean
  ultimaMensagem: { de: string; texto: string; em: string } | null
}

interface Lista {
  bot: { respondendo: boolean }
  contadores: { precisamHumano: number; assumidas: number; semResposta: number; total: number }
  conversas: ItemLista[]
}

interface Detalhe {
  id: string
  membro: {
    nome: string
    plano: string | null
    status: string | null
    telefone: string | null
    naBase: boolean
  }
  precisaHumano: boolean
  motivoTriagem: string | null
  assumida: boolean
  optOut: boolean
  janelaAberta: boolean
  mensagens: Array<{ id: string; de: string; texto: string | null; em: string }>
  nps: number | null
  insights: Array<{
    sobre: string
    categoria: string
    subcategoria: string | null
    sentimento: string
    urgencia: string
    tags: string[]
  }>
}

const quandoFoi = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `${Math.floor(s / 60)} min`
  if (s < 86400) return `${Math.floor(s / 3600)} h`
  return `${Math.floor(s / 86400)} d`
}

export default function Conversas() {
  const [lista, setLista] = useState<Lista | null>(null)
  const [filtro, setFiltro] = useState<'todas' | 'sem-resposta' | 'precisa-humano' | 'assumidas'>(
    'todas',
  )
  const [abertaId, setAbertaId] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fim = useRef<HTMLDivElement>(null)

  const carregarLista = useCallback(async () => {
    try {
      const q = filtro === 'todas' ? '' : `?filtro=${filtro}`
      const r = await fetch(`${API}/conversas${q}`)
      setLista(await r.json())
    } catch {
      setErro('não consegui falar com a API')
    }
  }, [filtro])

  const carregarDetalhe = useCallback(async (id: string) => {
    try {
      const r = await fetch(`${API}/conversas/${id}`)
      if (r.ok) setDetalhe(await r.json())
    } catch {
      /* a próxima sondagem tenta de novo */
    }
  }, [])

  useEffect(() => {
    carregarLista()
    const t = setInterval(carregarLista, 3000)
    return () => clearInterval(t)
  }, [carregarLista])

  useEffect(() => {
    if (!abertaId) return
    carregarDetalhe(abertaId)
    const t = setInterval(() => carregarDetalhe(abertaId), 2000)
    return () => clearInterval(t)
  }, [abertaId, carregarDetalhe])

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth' })
  }, [detalhe?.mensagens.length])

  async function responder(e: React.FormEvent) {
    e.preventDefault()
    if (!abertaId || !texto.trim() || enviando) return
    setEnviando(true)
    setErro(null)
    try {
      const r = await fetch(`${API}/conversas/${abertaId}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: texto.trim(), quem: 'equipe' }),
      })
      const d = await r.json()
      if (!r.ok) setErro(d.erro ?? 'não deu para enviar')
      else setTexto('')
      await carregarDetalhe(abertaId)
      await carregarLista()
    } finally {
      setEnviando(false)
    }
  }

  async function devolver() {
    if (!abertaId) return
    await fetch(`${API}/conversas/${abertaId}/devolver`, { method: 'POST' })
    await carregarDetalhe(abertaId)
    await carregarLista()
  }

  const c = lista?.contadores

  return (
    <main className="inbox">
      <header>
        <div>
          <h1>Conversas</h1>
          <p>Atualiza sozinho. Não precisa recarregar a página.</p>
        </div>
      </header>

      {erro && <div className="aviso">{erro}</div>}

      {lista && !lista.bot.respondendo && (
        <div className="aviso">
          <strong>Bot desligado.</strong> Tudo que chega é gravado e aparece aqui, mas ninguém
          responde sozinho. Quem responder é a equipe, por esta tela.
        </div>
      )}

      <nav className="filtros-inbox">
        {(
          [
            ['todas', `Todas${c ? ` (${c.total})` : ''}`],
            ['sem-resposta', `Sem resposta${c ? ` (${c.semResposta})` : ''}`],
            ['precisa-humano', `Precisam de você${c ? ` (${c.precisamHumano})` : ''}`],
            ['assumidas', `Com a equipe${c ? ` (${c.assumidas})` : ''}`],
          ] as const
        ).map(([v, rotulo]) => (
          <button
            key={v}
            type="button"
            className="chip-filtro"
            aria-pressed={filtro === v}
            onClick={() => setFiltro(v)}
          >
            {rotulo}
          </button>
        ))}
      </nav>

      <div className="inbox-grade">
        <section className="lista">
          {(lista?.conversas.length ?? 0) === 0 && (
            <p className="dica">Nenhuma conversa aqui ainda.</p>
          )}
          {lista?.conversas.map((i) => (
            <button
              key={i.id}
              type="button"
              className={`linha ${abertaId === i.id ? 'aberta' : ''} ${i.precisaHumano ? 'urgente' : ''}`}
              onClick={() => setAbertaId(i.id)}
            >
              <div className="linha-topo">
                <strong>{i.contato.nome}</strong>
                {i.ultimaMensagem && (
                  <span className="quando">{quandoFoi(i.ultimaMensagem.em)}</span>
                )}
              </div>
              <p className="previa">
                {i.ultimaMensagem
                  ? `${i.ultimaMensagem.de === 'aluno' ? '' : 'você: '}${i.ultimaMensagem.texto}`
                  : 'sem mensagem'}
              </p>
              <div className="linha-tags">
                {i.precisaHumano && <span className="tag urgente">{i.motivoTriagem ?? 'precisa de você'}</span>}
                {!i.contato.naBase && <span className="tag">não está na base</span>}
                {i.origem === 'laboratorio' && <span className="tag">laboratório</span>}
                {i.semResposta && !i.precisaHumano && <span className="tag">sem resposta</span>}
                {i.assumida && <span className="tag">com a equipe</span>}
                {!i.janelaAberta && <span className="tag">janela fechada</span>}
              </div>
            </button>
          ))}
        </section>

        <section className="thread">
          {!detalhe && <p className="dica">Escolha uma conversa à esquerda.</p>}

          {detalhe && (
            <>
              <div className="thread-topo">
                <div>
                  <strong>{detalhe.membro.nome}</strong>
                  <p className="sub">
                    {[
                      detalhe.membro.naBase ? detalhe.membro.plano : 'não está na base do EVO',
                      detalhe.membro.status?.toLowerCase(),
                      detalhe.membro.telefone,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="thread-acoes">
                  {detalhe.nps !== null && <span className="pilula">NPS {detalhe.nps}</span>}
                  {detalhe.optOut && <span className="tag urgente">opt-out</span>}
                  {detalhe.assumida && (
                    <button type="button" onClick={devolver}>
                      Devolver ao bot
                    </button>
                  )}
                </div>
              </div>

              {detalhe.insights.length > 0 && (
                <div className="faixa-insights">
                  {detalhe.insights.map((s, j) => (
                    <span key={j} className={`tag s-${s.sentimento.toLowerCase()}`}>
                      {s.subcategoria ?? s.categoria}
                    </span>
                  ))}
                </div>
              )}

              <div className="fluxo">
                {detalhe.mensagens.map((m) => (
                  <div key={m.id} className={`balao ${m.de === 'aluno' ? 'aluno' : 'bot'}`}>
                    {m.texto}
                  </div>
                ))}
                <div ref={fim} />
              </div>

              {!detalhe.janelaAberta && (
                <div className="aviso">
                  A janela de 24h fechou. Só dá para reabrir com um template pago.
                </div>
              )}

              <form onSubmit={responder}>
                <input
                  id="resposta-humana"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={
                    detalhe.janelaAberta ? 'responder como equipe' : 'janela fechada'
                  }
                  disabled={!detalhe.janelaAberta}
                  autoComplete="off"
                />
                <button type="submit" disabled={enviando || !texto.trim() || !detalhe.janelaAberta}>
                  Enviar
                </button>
              </form>
              <p className="dica-rodape">
                Ao responder, você assume a conversa e o bot para de conduzir a pesquisa.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
