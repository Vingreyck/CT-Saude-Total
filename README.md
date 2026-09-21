# CT Saúde Total

Plataforma de relacionamento e inteligência sobre o aluno, por cima do EVO (ABC Evo / w12.com.br).

Começa por um chatbot de WhatsApp humanizado que dispara em massa e **coleta informação estruturada** sobre os alunos, que é o valor central do projeto. Depois vêm reservas, financeiro, BI, operação interna e o app do cliente.

## Rodar

```bash
npm install && cp .env.example .env && npm run db:migrate && npm run db:seed
```

Depois `npm run dev:api`, `npm run dev:worker` e `npm run dev:web`. Passo a passo completo em [docs/07-setup.md](docs/07-setup.md).

## Estrutura

```
apps/
  api/       Fastify: webhooks do WhatsApp e do EVO, healthcheck
  worker/    pg-boss: sync do EVO, disparo, extração, crons
  web/       Next.js: painel do dono
packages/
  db/        Prisma: schema, migrations, seed da pesquisa
  shared/    telefone E.164, janela de 24h, horário de disparo
  evo/       client da API do EVO com retry e paginação
  whatsapp/  interface de canal + driver Cloud API
  ai/        provedor de IA, persona e o filtro de humanização
docs/        visão, backlog, sprints, arquitetura, decisões
```

## Documentação

| | |
|---|---|
| Índice | [docs/README.md](docs/README.md) |
| Backlog | [docs/02-backlog.md](docs/02-backlog.md) — 93 histórias, 15 épicos, 471 pontos |
| Sprints | [docs/03-sprints.md](docs/03-sprints.md) — Ciclo 1 (chatbot, disparo e coleta) em 3 sprints |
| Arquitetura | [docs/01-arquitetura.md](docs/01-arquitetura.md) |
| Setup e deploy | [docs/07-setup.md](docs/07-setup.md) |

## Princípio que desempata tudo

> A coleta de informação é o produto. O resto é embalagem.

Nenhuma conversa pode terminar apenas em texto livre. Todo fluxo desagua em dado estruturado e consultável, com o texto original preservado ao lado como evidência.

Status: **esqueleto no ar, build e testes passando. Modelagem começa em 21/09/2026.**
