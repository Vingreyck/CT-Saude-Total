import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { PERSONA, contextoParaPrompt } from './persona.js'
import {
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
 * Implementacao Claude (decidido em 19/09/2026, ver docs/04-comparativo-ia.md).
 *
 *   conversa  -> claude-sonnet-5   : naturalidade e obediencia a persona
 *   extracao  -> claude-haiku-4-5  : barato, alto volume, so precisa obedecer schema
 */

const MODELO_CONVERSA = process.env.IA_MODELO_CONVERSA ?? 'claude-sonnet-5'
const MODELO_EXTRACAO = process.env.IA_MODELO_EXTRACAO ?? 'claude-haiku-4-5'

const IntencaoSchema = z.object({
  intencao: z.enum(INTENCOES),
})

export class ProvedorClaude implements ProvedorIA {
  private client: Anthropic

  constructor(client = new Anthropic()) {
    this.client = client
  }

  async conversar(
    historico: TurnoConversa[],
    contexto: ContextoConversa,
  ): Promise<RespostaConversa> {
    const resposta = await this.client.messages.create({
      model: MODELO_CONVERSA,
      max_tokens: 400,
      // Efeito low: conversa de WhatsApp precisa de latencia baixa, nao de
      // raciocinio profundo. Subir isso aqui so encarece e demora.
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: [
        // Bloco estavel primeiro, com cache. Economiza ~70% do input em
        // conversa longa, porque o prompt inteiro volta a cada turno.
        { type: 'text', text: PERSONA, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: contextoParaPrompt(contexto) },
      ],
      messages: historico.map((t) => ({
        role: t.papel === 'aluno' ? ('user' as const) : ('assistant' as const),
        content: t.texto,
      })),
    })

    const texto = resposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    return {
      texto,
      tokensEntrada: resposta.usage.input_tokens,
      tokensSaida: resposta.usage.output_tokens,
      modelo: MODELO_CONVERSA,
    }
  }

  async extrair(texto: string): Promise<Extracao> {
    const resposta = await this.client.messages.parse({
      model: MODELO_EXTRACAO,
      max_tokens: 1000,
      system:
        'Você classifica feedback de alunos de academia. Escolha SOMENTE valores da lista permitida. ' +
        'Quando o texto não disser algo, use null em vez de inventar. ' +
        'urgencia ALTA é só para o que precisa de alguém agora: vazamento, equipamento quebrado, risco de acidente.',
      messages: [{ role: 'user', content: texto }],
      output_config: { format: zodOutputFormat(ExtracaoSchema) },
    })

    if (!resposta.parsed_output) {
      throw new Error(`extracao falhou, modelo nao devolveu JSON valido para: ${texto.slice(0, 80)}`)
    }
    return resposta.parsed_output
  }

  async classificarIntencao(texto: string): Promise<Intencao> {
    const resposta = await this.client.messages.parse({
      model: MODELO_EXTRACAO,
      max_tokens: 200,
      system: 'Classifique a intenção da mensagem de um aluno de academia. Escolha uma opção da lista.',
      messages: [{ role: 'user', content: texto }],
      output_config: { format: zodOutputFormat(IntencaoSchema) },
    })

    return resposta.parsed_output?.intencao ?? 'OUTRO'
  }
}
