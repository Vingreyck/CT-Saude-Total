import type { ProvedorIA } from './provedor.js'
import { ProvedorClaude } from './anthropic.js'
import { ProvedorGemini } from './gemini.js'

/**
 * Escolhe o provedor de IA.
 *
 * IA_PROVEDOR=claude|gemini manda. Sem ele, usa a chave que existir, dando
 * preferencia ao Claude porque e a escolha registrada em
 * docs/04-comparativo-ia.md; o Gemini entra como o que esta disponivel hoje.
 *
 * Trocar de provedor e mudar uma variavel de ambiente. Nenhum outro arquivo
 * do sistema sabe qual IA esta rodando.
 */
export function criarProvedorIA(): ProvedorIA {
  const escolhido = (process.env.IA_PROVEDOR ?? '').toLowerCase()
  const temGemini = !!(process.env.API_GEMINI || process.env.GEMINI_API_KEY)
  const temClaude = !!process.env.ANTHROPIC_API_KEY

  if (escolhido === 'gemini') return new ProvedorGemini()
  if (escolhido === 'claude') return new ProvedorClaude()

  if (temClaude) return new ProvedorClaude()
  if (temGemini) return new ProvedorGemini()

  throw new Error(
    'nenhuma chave de IA configurada. Defina ANTHROPIC_API_KEY ou API_GEMINI.',
  )
}

/** Qual provedor seria usado agora, sem instanciar nada. Serve para o painel. */
export function provedorAtual(): 'claude' | 'gemini' | 'nenhum' {
  const escolhido = (process.env.IA_PROVEDOR ?? '').toLowerCase()
  if (escolhido === 'gemini' || escolhido === 'claude') return escolhido
  if (process.env.ANTHROPIC_API_KEY) return 'claude'
  if (process.env.API_GEMINI || process.env.GEMINI_API_KEY) return 'gemini'
  return 'nenhum'
}
