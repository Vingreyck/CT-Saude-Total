'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Campanhas: criar, ver o custo antes, disparar em teste e depois liberar.
 *
 * O fluxo obriga o disparo de teste antes do lote completo. Não é zelo
 * excessivo: a primeira campanha real é a que decide se o dono confia no
 * sistema, e um erro nela queima a reputação do número na Meta.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://ctapi-production.up.railway.app'

interface Segmento {
  nome: string
  rotulo: string
  descricao: string
  pessoas: number
}

interface Custo {
  pessoas: number
  template: number
  conversa: number
  total: number
  premissa: string
}

interface Campanha {
  id: string
  nome: string
  tipo: string
  status: string
  custoEstimado: string | null
  alvos: number
  resultado: {
    pendentes: number
    enviados: number
    entregues: number
    respondidos: number
    falhas: number
    pulados: number
  }
}

const reais = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`

export default function Campanhas() {
  const [segmentos, setSegmentos] = useState<Segmento[]>([])
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [nome, setNome] = useState('Pesquisa de satisfação')
  const [template, setTemplate] = useState('pesquisa_satisfacao')
  const [segmento, setSegmento] = useState('ativos')
  const [categoria, setCategoria] = useState<'marketing' | 'utility'>('marketing')
  const [custo, setCusto] = useState<Custo | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        fetch(`${API}/campanhas/segmentos`).then((r) => r.json()),
        fetch(`${API}/campanhas`).then((r) => r.json()),
      ])
      setSegmentos(s)
      setCampanhas(c)
    } catch {
      setErro('não consegui falar com a API')
    }
  }, [])

  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 5000)
    return () => clearInterval(t)
  }, [carregar])

  useEffect(() => {
    fetch(`${API}/campanhas/estimativa?segmento=${segmento}&categoria=${categoria}`)
      .then((r) => r.json())
      .then(setCusto)
      .catch(() => setCusto(null))
  }, [segmento, categoria])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setErro(null)
    setMsg(null)
    try {
      const r = await fetch(`${API}/campanhas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, template, segmento, categoria, tipo: 'FEEDBACK' }),
      })
      const d = await r.json()
      if (!r.ok) setErro(d.erro ?? 'não deu para criar')
      else setMsg(`campanha criada com ${d.alvos} pessoas. Agora faça o disparo de teste.`)
      await carregar()
    } finally {
      setOcupado(false)
    }
  }

  async function disparar(id: string, teste: boolean) {
    setOcupado(true)
    setErro(null)
    setMsg(null)
    try {
      const r = await fetch(`${API}/campanhas/${id}/disparar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teste, confirmado: !teste }),
      })
      const d = await r.json()
      if (!r.ok) setErro(d.erro ?? 'não deu para disparar')
      else setMsg(d.aviso ?? `${d.enfileirados} mensagens na fila. Sai no ritmo do limite.`)
      await carregar()
    } finally {
      setOcupado(false)
    }
  }

  async function pausar(id: string) {
    await fetch(`${API}/campanhas/${id}/pausar`, { method: 'POST' })
    await carregar()
  }

  const escolhido = segmentos.find((s) => s.nome === segmento)

  return (
    <main>
      <header>
        <h1>Campanhas</h1>
        <p>Dispare para a base e acompanhe o resultado.</p>
      </header>

      {erro && <div className="aviso">{erro}</div>}
      {msg && <div className="aviso ok">{msg}</div>}

      <section className="cartao-form">
        <h2>Nova campanha</h2>
        <form onSubmit={criar} className="form-campanha">
          <label>
            <span>Nome</span>
            <input id="c-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>

          <label>
            <span>Template aprovado na Meta</span>
            <input id="c-template" value={template} onChange={(e) => setTemplate(e.target.value)} />
          </label>

          <label>
            <span>Para quem</span>
            <select id="c-segmento" value={segmento} onChange={(e) => setSegmento(e.target.value)}>
              {segmentos.map((s) => (
                <option key={s.nome} value={s.nome}>
                  {s.rotulo} ({s.pessoas})
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Categoria do template</span>
            <select
              id="c-categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as 'marketing' | 'utility')}
            >
              <option value="marketing">Marketing (~R$ 0,34 por pessoa)</option>
              <option value="utility">Utilidade (~R$ 0,04 por pessoa)</option>
            </select>
          </label>

          {escolhido && <p className="dica">{escolhido.descricao}</p>}

          {custo && (
            <div className="custo">
              <div className="custo-linhas">
                <span>{custo.pessoas} pessoas</span>
                <span>template {reais(custo.template)}</span>
                <span>conversa {reais(custo.conversa)}</span>
                <strong>total {reais(custo.total)}</strong>
              </div>
              <p className="dica">Premissa: {custo.premissa}</p>
            </div>
          )}

          <button type="submit" disabled={ocupado || !custo || custo.pessoas === 0}>
            Criar campanha
          </button>
          <p className="dica">Criar não dispara nada. Fica em rascunho.</p>
        </form>
      </section>

      <section>
        <h2 style={{ fontSize: 15, marginBottom: 10 }}>Campanhas</h2>
        {campanhas.length === 0 && <p className="dica">Nenhuma campanha ainda.</p>}

        <div className="lista-campanhas">
          {campanhas.map((c) => {
            const r = c.resultado
            const saiu = r.enviados + r.entregues + r.respondidos
            return (
              <div key={c.id} className="cartao-campanha">
                <div className="linha-topo">
                  <strong>{c.nome}</strong>
                  <span className="pilula">{c.status.toLowerCase()}</span>
                  {c.custoEstimado && (
                    <span className="quando">estimado {reais(Number(c.custoEstimado))}</span>
                  )}
                </div>

                <div className="numeros">
                  <span><b>{c.alvos}</b> no lote</span>
                  <span><b>{saiu}</b> saíram</span>
                  <span><b>{r.respondidos}</b> responderam</span>
                  <span><b>{r.pulados}</b> pulados</span>
                  <span><b>{r.falhas}</b> falhas</span>
                  <span><b>{r.pendentes}</b> na fila</span>
                </div>

                <div className="acoes-campanha">
                  {c.status === 'RASCUNHO' && (
                    <button type="button" disabled={ocupado} onClick={() => disparar(c.id, true)}>
                      Disparo de teste (100)
                    </button>
                  )}
                  {(c.status === 'TESTE' || c.status === 'PAUSADA') && (
                    <button type="button" disabled={ocupado} onClick={() => disparar(c.id, false)}>
                      Liberar para todos
                    </button>
                  )}
                  {(c.status === 'DISPARANDO' || c.status === 'TESTE') && (
                    <button type="button" onClick={() => pausar(c.id)}>
                      Pausar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
