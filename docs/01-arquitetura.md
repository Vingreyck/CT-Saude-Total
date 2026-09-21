# Arquitetura e Infraestrutura

## 1. Visão geral

```
                       +------------------------------+
   WhatsApp (Meta) --->|  webhook /whatsapp           |
                       |                              |
   EVO (w12) --------->|  webhook /evo                |
                       |                              |
                       |        API (NestJS)          |<---- Painel Web (Next.js)
                       |   REST + auth + regras       |
                       +-------+--------------+-------+
                               |              |
                     +---------v--+     +-----v--------+
                     | PostgreSQL |     |   Worker     |
                     | (Railway)  |     | (mesma img)  |
                     +------------+     +-----+--------+
                                              |
                              filas: sync EVO, disparo, extracao
                              crons: aniversario, ausencia, NPS
                                              |
                                       +------v------+
                                       |   LLM API   |  (provedor a definir)
                                       +-------------+
```

## 2. Stack recomendada

| Camada | Escolha | Por quê |
|---|---|---|
| Linguagem | TypeScript em tudo | Um dev, uma linguagem, tipos compartilhados entre API e web |
| API | **Fastify** | Trocado de NestJS na montagem do esqueleto. Motivo na seção 2.1 |
| ORM | Prisma | Migrations versionadas, tipos gerados, ótimo com Postgres |
| Banco | PostgreSQL (Railway) | Definido por você |
| Fila | **pg-boss** (fila em cima do Postgres) | Evita um serviço Redis a mais no Railway. Para 1 a 3 mil alunos sobra. BullMQ + Redis é o plano B se o volume crescer, e só `apps/worker/src/main.ts` muda |
| Web | Next.js (App Router) + Tailwind + shadcn/ui | Painel rápido de construir, SSR para as listas grandes |
| Auth | better-auth (ou NextAuth) com papéis | RBAC é necessário desde cedo: ADM vê tudo, gerente vê a unidade, professor vê o próprio |
| Observabilidade | Logs estruturados (pino) + Sentry free | Disparo em massa sem log é suicídio |
| Deploy | Railway | Definido por você |

**Serviços no Railway:** `api`, `worker`, `web`, `postgres`. Quatro serviços, sem Redis no início.

**Gerenciador de pacotes: npm workspaces**, não pnpm. Vem junto com o Node, não precisa instalar nada, e para 8 pacotes a diferença de performance não paga a fricção de exigir uma ferramenta a mais na máquina de quem for mexer no projeto depois.

### 2.1 Por que Fastify e não NestJS

O plano original dizia NestJS. Na hora de montar, apareceu um custo que não estava à vista: o NestJS trabalha melhor em CommonJS, enquanto os packages compartilhados (`@ct/db`, `@ct/ai`, `@ct/shared`) são ESM. Misturar os dois num monorepo gera erro de resolução de módulo que consome tempo e volta a aparecer a cada dependência nova.

Fastify é ESM nativo, sobe em um arquivo, e o que o NestJS traria de valor aqui (organização por módulo) a estrutura de pastas já entrega. A troca economiza uma classe inteira de problema de build sem perder nada que o projeto precise.

Se em algum momento o projeto pedir DI de verdade ou interceptadores, a migração continua possível, e aí o custo estará justificado.

## 3. Estrutura do repositório

```
ct-saude-total/
├── apps/
│   ├── api/          NestJS: REST, webhooks, RBAC
│   ├── worker/       mesma imagem da api, entrypoint de filas e crons
│   └── web/          Next.js: painel do dono
├── packages/
│   ├── db/           Prisma schema + migrations + seed
│   ├── shared/       tipos, DTOs, schemas zod compartilhados
│   ├── evo/          client tipado da API do EVO
│   ├── whatsapp/     driver de canal (interface + implementações)
│   └── ai/           provider de LLM (interface + implementações) + filtro de humanização
└── docs/
```

## 4. Decisões de arquitetura que importam

### 4.1 Canal de WhatsApp atrás de uma interface

O canal é a peça mais volátil do projeto (custo, política da Meta, risco de ban). Ele fica atrás de uma interface:

```ts
interface CanalWhatsapp {
  enviarTemplate(p: EnvioTemplate): Promise<ResultadoEnvio>
  enviarTexto(p: EnvioTexto): Promise<ResultadoEnvio>
  // o webhook normaliza tudo para um formato único de MensagemRecebida
}
```

Trocar de provedor (Cloud API oficial, Evolution API, BSP) vira trocar uma implementação, não reescrever o motor de campanha. Ver seção 6.

### 4.2 Provedor de LLM atrás de uma interface

Mesma lógica. A escolha de qual IA conduz o bot é sua, e ela vai mudar com o tempo conforme preço e qualidade. O código fala com `ProvedorIA`, não com um SDK específico. Comparativo em [04-comparativo-ia.md](04-comparativo-ia.md).

### 4.3 O EVO é espelhado, não copiado

Nunca criamos aluno no nosso banco como fonte da verdade. Sincronizamos: cada `membro` local guarda `id_evo`, `sincronizado_em` e o payload bruto. Se divergir, o EVO ganha. Campos que **são** nossos (tags, insights, consentimento, histórico de conversa) vivem em tabelas separadas e nunca são sobrescritos pelo sync.

### 4.4 Extração estruturada é um passo de primeira classe

Toda resposta de texto livre passa por um job de extração que devolve JSON validado por schema: categoria, sentimento, entidades (equipamento citado, professor citado, horário citado), urgência e tags. É isso que transforma "o banheiro tava sujo" em uma linha filtrável no painel. Sem essa etapa, a coleta vira caixa de texto inútil, e a coleta é o diamante do projeto.

### 4.5 Idempotência no disparo

Cada envio tem chave idempotente (`campanha_id + membro_id`). Reprocessar a fila nunca pode mandar a mesma mensagem duas vezes para a mesma pessoa. Esse é o erro mais caro possível nesse produto: disparo duplicado queima a reputação do número e o dono perde a confiança no sistema no primeiro dia.

## 5. Modelo de dados inicial (esboço)

```
unidade
membro                 id_evo, nome, telefone_e164, status, plano, nascimento, inicio_contrato
contato_consentimento  membro_id, canal, status (opt_in|opt_out), origem, data
conversa               membro_id, canal, status, janela_servico_expira_em
mensagem               conversa_id, direcao, tipo, texto, midia_url, provider_message_id, status_entrega
campanha               nome, tipo (aniversario|novidade|feedback|aviso|retorno), template_id, agendada_para
campanha_alvo          campanha_id, membro_id, chave_idempotencia, status
evento_entrega         mensagem_id, evento (enviado|entregue|lido|falhou), payload
pesquisa               nome, versao, ativa
pergunta               pesquisa_id, ordem, tipo (nota|escala|opcao|texto), obrigatoria, enunciado
resposta_pesquisa      pesquisa_id, membro_id (opcional se anonima), iniciada_em, concluida_em, nps
resposta_item          resposta_pesquisa_id, pergunta_id, valor_num, valor_texto, valor_opcao
insight                origem (mensagem|resposta_item), categoria, sentimento, urgencia, entidades jsonb, tags[]
checkin                membro_id, data_hora, origem (catraca_evo)
alerta_ausencia        membro_id, dias_sem_ir, disparado_em
reserva                tipo (recovery|quadra), membro_id, inicio, fim, status
chamado                tipo, local, descricao, prioridade, aberto_por, status, resolvido_em
usuario_interno        nome, funcao (atendente|professor|gerente|adm), unidade_id
turno                  usuario_interno_id, inicio, fim, tipo (escala|troca)
pontuacao              usuario_interno_id, motivo (indicacao|contrato), pontos, referencia
```

Regra de ouro: **dado do EVO em tabela espelho, dado nosso em tabela própria.**

## 6. Canal de WhatsApp: as duas rotas

| | **Cloud API oficial (Meta)** | **Evolution API (não oficial)** |
|---|---|---|
| Custo por mensagem | Marketing ~R$ 0,31 a 0,38; Utility ~R$ 0,04; Service dentro da janela de 24h **grátis** | Zero por mensagem, só o custo do servidor |
| Risco de banimento | Praticamente nulo seguindo a política | Real e permanente. Números em API não oficial costumam ser pegos pelo antifraude da Meta em semanas quando fazem volume |
| Número | Precisa de número dedicado e verificação do negócio | Usa número comum, conecta por QR |
| Templates | Obrigatório aprovar template para iniciar conversa | Sem template |
| Prazo para começar | Dias (verificação do Business Manager) | Horas |
| Suporte e SLA | Sim | Comunidade |

**Recomendação:** Cloud API oficial para o disparo em massa. O produto inteiro depende do número da academia continuar vivo; perder o número por ban não é risco que compense para economizar alguns reais por campanha. A Evolution API vale como ambiente de desenvolvimento e teste com números descartáveis, atrás da mesma interface `CanalWhatsapp`.

### Estratégia de custo do disparo

Isso vale dinheiro de verdade: **mensagem de serviço, dentro da janela de 24 horas aberta pela resposta do cliente, é gratuita**. Então o desenho correto é:

1. Um único template pago abre a conversa ("posso te fazer 3 perguntas rápidas sobre o CT?").
2. O cliente responde, o que abre a janela de serviço de 24h.
3. **Toda a pesquisa acontece dentro da janela, de graça.**

Simulação para 1.000 alunos ativos, campanha de feedback, 40% de resposta:

| Item | Cálculo | Custo |
|---|---|---|
| Template de abertura (marketing) | 1.000 x ~R$ 0,34 | ~R$ 340 |
| Conversa da pesquisa | 400 x grátis (janela de serviço) | R$ 0 |
| LLM conduzindo 400 conversas | ver [04-comparativo-ia.md](04-comparativo-ia.md) | R$ 100 a 260 |
| **Total por campanha completa** | | **~R$ 440 a 600** |

Se o template for enquadrado como *utility* em vez de *marketing* (avisos operacionais, lembrete de ausência, confirmação de reserva), o custo de abertura cai de ~R$ 340 para ~R$ 40. Vale desenhar os textos com isso em mente desde o primeiro template.

## 7. Integração com o EVO

Base: `https://evo-integracao.w12app.com.br`, autenticação por token gerado em Configurações, Integrações, aba Tokens, onde também dá para acompanhar o consumo por mês e por token.

Endpoints que sustentam o nosso escopo:

| Necessidade | Endpoint |
|---|---|
| Base de alunos e telefone | `GET /api/v1/members`, `GET /api/v1/members/{idMember}` |
| Leads que não fecharam | `GET /api/v1/prospects` |
| Catraca e entradas (lembrete de ausência) | recursos `accessControl` (`/api/v2/accessControl/*`) |
| Aulas e agenda | `GET /api/v1/activities`, `/api/v1/activities/schedule` |
| Reservas e inscrições | `POST /api/v2/activities/booking`, `/api/v2/activities/enroll` |
| Funcionários | `GET /api/v1/employees` |
| Planos e contratos | `GET /api/v1/memberships` |
| Financeiro | recursos `Receivables` e `Invoices` |
| Eventos em tempo real | Webhooks do EVO |

### 7.1 Como descobrir se o plano da academia libera API, em 5 minutos

A ABC Evo não publica qual plano inclui API. O preço é por número de unidades e de alunos, negociado caso a caso. Então não adianta procurar na internet, a resposta está dentro do painel da própria academia.

**Caminho 1, o mais rápido.** Alguém com acesso de administrador no EVO entra e vai em **Configurações → Integrações**. Se aparecer a aba **Tokens**, está liberado: é ali que o token é gerado, e na aba **Consumo** dá para ver o limite de requisições por mês. Se o menu não aparecer ou vier bloqueado, não está liberado.

**Caminho 2, se o menu não aparecer.** Abrir chamado no suporte da ABC Evo perguntando exatamente isto:

> Nosso plano atual libera acesso à EVO API? Se não, qual plano libera e qual a diferença de valor? Qual o limite de requisições por mês? O histórico de acesso da catraca está disponível por endpoint de consulta ou só por webhook?

**O que fazer com cada resposta:**

| Resposta | Efeito no plano |
|---|---|
| Liberado, com limite folgado | Segue tudo como está em [03-sprints.md](03-sprints.md) |
| Liberado, mas com limite apertado | Sincronismo vira incremental e menos frequente. Custa uns 3 pontos a mais no CT-012 |
| Precisa subir de plano | Decisão comercial do dono. Vale levar o número: sem API, não existe disparo em massa nem lembrete de ausência |
| Catraca só por webhook | O épico de retenção (CT-070) depende de webhook configurado, e a carga histórica dos 90 dias não existe |

**Importante:** quem faz isso é o dono ou quem tem login de administrador da academia. Você não consegue descobrir de fora.

**Risco aberto, validar na segunda:** confirmar se o plano do EVO contratado pela academia libera API, qual o rate limit por token, e se o histórico de catraca vem por endpoint de consulta ou só por webhook. Essa resposta muda a estimativa do épico de retenção. É a primeira tarefa da Sprint 0.

## 8. LGPD, que não é opcional aqui

Disparo em massa, coleta de dado pessoal e análise por IA é exatamente o cenário que a ANPD olha. O mínimo obrigatório, embutido no backlog e não deixado para depois:

- **Base legal** declarada por finalidade. Comunicação de serviço ao aluno ativo tende a apoiar-se em execução de contrato; pesquisa e marketing pedem consentimento ou legítimo interesse documentado.
- **Opt-out em toda mensagem** de campanha, honrado imediatamente e para sempre, com bloqueio em nível de banco e não só de fluxo.
- **Registro de consentimento** com data, canal, texto exato aceito e origem.
- **Anonimato da pesquisa respeitado.** O formulário atual promete que é anônima. No WhatsApp o número identifica a pessoa, então ou o texto muda, ou a resposta é despersonalizada na gravação. Decisão de produto pendente, ver [06-pesquisa-satisfacao.md](06-pesquisa-satisfacao.md).
- **Retenção e expurgo** definidos por tabela.
- **Acesso segmentado.** Professor não vê a conversa do aluno com a recepção. ADM vê tudo, e isso precisa estar escrito na política interna.
