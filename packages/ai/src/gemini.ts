import { PERSONA, contextoParaPrompt } from './persona.js'
import {
  CATEGORIAS,
  ExtracaoSchema,
  INTENCOES,
  type ContextoConversa,
  type Extracao,
  type Intencao,
  type ProvedorIA,
  type RespostaConversa,
  type TurnoConversa,
} from './provedor.js'

/**
 * Implementação Google Gemini.
 *
 * Fala direto com a REST API em vez de usar o SDK: são duas chamadas simples,
 * e assim o projeto não ganha mais uma dependência que precisa acompanhar
 * versão.
 *
 * Modelos confirmados como disponíveis na chave do projeto em 22/09/2026.
 * A conversa usa flash e a extração usa flash-lite, que é mais barato e só
 * precisa obedecer schema.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

const MODELO_CONVERSA = process.env.IA_MODELO_CONVERSA ?? 'gemini-3.8-flash'
const MODELO_EXTRACAO = process.env.IA_MODELO_EXTRACAO ?? 'gemini-flash-lite-latest'

/** Schema no formato que o Gemini aceita, espelhando o ExtracaoSchema do zod. */
const SCHEMA_EXTRACAO = {
  type: 'object',
  properties: {
    categoria: { type: 'string', enum: [...CATEGORIAS] },
    subcategoria: { type: 'string', nullable: true },
    sentimento: { type: 'string', enum: ['POSITIVO', 'NEUTRO', 'NEGATIVO'] },
    urgencia: { type: 'string', enum: ['BAIXA', 'MEDIA', 'ALTA'] },
    entidades: {
      type: 'object',
      properties: {
        professor: { type: 'string', nullable: true },
        equipamento: { type: 'string', nullable: true },
        local: { type: 'string', nullable: true },
        periodo: { type: 'string', nullable: true },
      },
      required: ['professor', 'equipamento', 'local', 'periodo'],
    },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['categoria', 'subcategoria', 'sentimento', 'urgencia', 'entidades', 'tags'],
}

const SCHEMA_INTENCAO = {
  type: 'object',
  properties: { intencao: { type: 'string', enum: [...INTENCOES] } },
  required: ['intencao'],
}

interface RespostaGemini {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  error?: { message?: string; status?: string }
}

export class ProvedorGemini implements ProvedorIA {
  constructor(private chave = process.env.API_GEMINI ?? process.env.GEMINI_API_KEY ?? '') {
    if (!this.chave) {
      throw new Error('API_GEMINI vazia. Gere em aistudio.google.com/apikey')
    }
  }

  private async chamar(
    modelo: string,
    corpo: Record<string, unknown>,
  ): Promise<{ texto: string; entrada: number; saida: number }> {
    const r = await fetch(`${BASE}/${modelo}:generateContent?key=${this.chave}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(60_000),
    })

    const d = (await r.json()) as RespostaGemini

    if (!r.ok || d.error) {
      throw new Error(`gemini ${r.status}: ${d.error?.message ?? 'falhou'}`)
    }

    const candidato = d.candidates?.[0]

    // finishReason SAFETY significa que o filtro do Google barrou a resposta.
    // Devolver string vazia aqui deixaria o aluno no vacuo sem ninguem saber.
    if (candidato?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidato.finishReason)) {
      throw new Error(`gemini recusou a resposta: ${candidato.finishReason}`)
    }

    const texto = (candidato?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim()

    return {
      texto,
      entrada: d.usageMetadata?.promptTokenCount ?? 0,
      saida: d.usageMetadata?.candidatesTokenCount ?? 0,
    }
  }

  async conversar(
    historico: TurnoConversa[],
    contexto: ContextoConversa,
  ): Promise<RespostaConversa> {
    const r = await this.chamar(MODELO_CONVERSA, {
      systemInstruction: {
        parts: [{ text: PERSONA }, { text: contextoParaPrompt(contexto) }],
      },
      contents: historico.map((t) => ({
        role: t.papel === 'aluno' ? 'user' : 'model',
        parts: [{ text: t.texto }],
      })),
      generationConfig: {
        // Conversa de WhatsApp: resposta curta e com alguma variacao, senao
        // o bot repete a mesma formula a cada turno e fica obvio.
        temperature: 0.9,
        maxOutputTokens: 400,
      },
    })

    return {
      texto: r.texto,
      tokensEntrada: r.entrada,
      tokensSaida: r.saida,
      modelo: MODELO_CONVERSA,
    }
  }

  async extrair(texto: string): Promise<Extracao> {
    const r = await this.chamar(MODELO_EXTRACAO, {
      systemInstruction: {
        parts: [
          {
            text:
              'Você classifica feedback de alunos de academia. Escolha SOMENTE valores da lista permitida. ' +
              'Quando o texto não disser algo, use null em vez de inventar. ' +
              'urgencia ALTA é só para o que precisa de alguém agora: vazamento, equipamento quebrado, risco de acidente.',
          },
        ],
      },
      contents: [{ role: 'user', parts: [{ text: texto }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: SCHEMA_EXTRACAO,
      },
    })

    // O schema do Gemini reduz muito o erro, mas nao garante. O zod e quem
    // decide se entra no banco.
    return ExtracaoSchema.parse(JSON.parse(r.texto))
  }

  async classificarIntencao(texto: string): Promise<Intencao> {
    try {
      const r = await this.chamar(MODELO_EXTRACAO, {
        systemInstruction: {
          parts: [{ text: 'Classifique a intenção da mensagem de um aluno de academia.' }],
        },
        contents: [{ role: 'user', parts: [{ text: texto }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA_INTENCAO,
        },
      })
      const d = JSON.parse(r.texto) as { intencao?: string }
      return (INTENCOES as readonly string[]).includes(d.intencao ?? '')
        ? (d.intencao as Intencao)
        : 'OUTRO'
    } catch {
      // Classificar intencao e util, nao critico. Falhar aqui nao pode
      // derrubar o atendimento do aluno.
      return 'OUTRO'
    }
  }
}
