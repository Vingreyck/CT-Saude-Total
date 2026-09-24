'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * A conexão com o EVO, vista pelo dono.
 *
 * Duas perguntas que esta faixa responde sem ninguém pedir relatório: a base
 * daqui é a mesma do EVO, e de quando é essa foto. Sistema que espelha dado de
 * outro lugar sem dizer quando sincronizou é sistema em que ninguém confia.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://ctapi-production.up.railway.app'

interface Estado {
  total: number
  ativos: number
  comContato: number
  cobertura: number
  configurado: boolean
  sincronizando: boolean
  ultima: {
    em: string | null
    modo: string
    origem: string
    lidos: number
    criados: number
    atualizados: number
    erro: string | null
  } | null
}

function quandoFoi(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 90) return 'agora há pouco'
  if (s < 3600) return `há ${Math.floor(s / 60)} minutos`
  if (s < 86400) return `há ${Math.floor(s / 3600)} horas`
  return `há ${Math.floor(s / 86400)} dias`
}

export function EstadoEvo() {
  const [e, setE] = useState<Estado | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`${API}/evo/estado`)
      if (r.ok) setE(await r.json())
    } catch {
      /* a próxima tentativa resolve */
    }
  }, [])

  useEffect(() => {
    carregar()
    // Enquanto uma sincronização roda, a tela precisa andar junto. Parada em
    // "sincronizando" para sempre é o jeito mais rápido de parecer travado.
    const t = setInterval(carregar, 5000)
    return () => clearInterval(t)
  }, [carregar])

  async function sincronizar(completo: boolean) {
    setOcupado(true)
    setMsg(null)
    try {
      const r = await fetch(`${API}/evo/sincronizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completo }),
      })
      const d = await r.json()
      setMsg(r.ok ? (d.aviso ?? 'começou') : (d.erro ?? 'não deu para sincronizar'))
      await carregar()
    } finally {
      setOcupado(false)
    }
  }

  if (!e) return null

  return (
    <section className="cartao-form" style={{ marginBottom: 28 }}>
      <h2>Base do EVO</h2>

      {!e.configurado && (
        <div className="aviso">
          Sem <code>EVO_DNS</code> ou <code>EVO_TOKEN</code>. Nada é puxado enquanto isso.
        </div>
      )}

      <div className="custo-linhas" style={{ marginBottom: 10 }}>
        <span>
          <strong>{e.total}</strong> alunos no total
        </span>
        <span>
          <strong>{e.ativos}</strong> ativos
        </span>
        <span>
          <strong>{e.comContato}</strong> com WhatsApp ({e.cobertura}%)
        </span>
      </div>

      <p className="dica">
        {e.sincronizando
          ? 'sincronizando agora, os números mudam sozinhos nesta tela'
          : e.ultima?.em
            ? `sincronizado ${quandoFoi(e.ultima.em)}, ${e.ultima.lidos} lidos do EVO ` +
              `(${e.ultima.criados} novos, ${e.ultima.atualizados} atualizados)`
            : 'nunca sincronizou'}
      </p>

      {e.ultima?.erro && <div className="aviso">Última tentativa falhou: {e.ultima.erro}</div>}

      <div className="acoes-campanha">
        <button type="button" disabled={ocupado || e.sincronizando} onClick={() => sincronizar(false)}>
          Sincronizar agora
        </button>
        <button type="button" disabled={ocupado || e.sincronizando} onClick={() => sincronizar(true)}>
          Puxar a base inteira
        </button>
      </div>

      <p className="dica" style={{ marginTop: 8 }}>
        Sozinho, o sistema sincroniza de 2 em 2 horas. &quot;Sincronizar agora&quot; pede só quem
        mudou desde a última vez e gasta quase nada de cota.
      </p>

      {msg && <p className="dica">{msg}</p>}
    </section>
  )
}
