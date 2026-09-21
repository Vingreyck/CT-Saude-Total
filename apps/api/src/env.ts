import { z } from 'zod'

/**
 * Validacao de ambiente na subida.
 *
 * Falhar aqui, com mensagem clara, e muito melhor que descobrir no meio de um
 * disparo para 1.000 pessoas que o token estava vazio.
 */
const Schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1, 'sem banco nao sobe. No Railway isso vem preenchido'),

  EVO_BASE_URL: z.string().min(1).default('https://evo-integracao.w12app.com.br'),
  EVO_TOKEN: z.string().min(1, 'gere em Configuracoes > Integracoes > Tokens no painel do EVO'),
  EVO_WEBHOOK_SECRET: z.string().optional(),

  WHATSAPP_DRIVER: z.enum(['oficial', 'evolution']).default('oficial'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
})

const resultado = Schema.safeParse(process.env)

if (!resultado.success) {
  console.error('variaveis de ambiente invalidas:')
  for (const erro of resultado.error.issues) {
    console.error(`  ${erro.path.join('.')}: ${erro.message}`)
  }
  console.error('')
  console.error('copie .env.example para .env e preencha')
  process.exit(1)
}

export const env = resultado.data
