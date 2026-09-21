# Setup e Deploy

## 1. Rodar na sua máquina

Precisa de Node 22 ou mais novo. Só isso, npm já vem junto.

```bash
npm install
```

```bash
cp .env.example .env
```

Preencha pelo menos `DATABASE_URL` no `.env`. Para o resto (EVO, WhatsApp, Anthropic), o sistema sobe sem, mas avisa o que falta.

Sem Postgres local? Sobe um em segundos com Docker:

```bash
docker run --name ct-pg -e POSTGRES_PASSWORD=ct -e POSTGRES_DB=ct_saude_total -p 5432:5432 -d postgres:16
```

Aí a `DATABASE_URL` fica `postgresql://postgres:ct@localhost:5432/ct_saude_total?schema=public`.

Criar as tabelas e popular a pesquisa:

```bash
npm run db:migrate && npm run db:seed
```

Subir os três serviços, cada um no seu terminal:

```bash
npm run dev:api
```

```bash
npm run dev:worker
```

```bash
npm run dev:web
```

Painel em `http://localhost:3000`, API em `http://localhost:3333/health`.

## 2. Comandos do dia a dia

| Comando | O que faz |
|---|---|
| `npm run typecheck` | Compila os pacotes e checa tipo em tudo |
| `npm test` | Roda os testes (filtro de humanização e telefone) |
| `npm run build` | Build de produção completo |
| `npm run db:studio` | Abre o navegador de banco do Prisma |
| `npm run db:migrate` | Cria uma migration nova depois de mexer no schema |

## 3. Deploy no Railway

Este é um **monorepo compartilhado** (npm workspaces, pacotes que os três apps usam). Isso muda a configuração e é onde quase todo mundo erra.

**Não use Root Directory.** Se você apontar o Root Directory de um serviço para `apps/api`, o build passa a rodar dentro daquela pasta, onde não existe `package-lock.json` nem os `packages/`, e o install quebra. O build tem que rodar a partir da raiz do repositório, sempre.

O que separa um serviço do outro é o **arquivo de configuração**, não a pasta.

### Passo a passo

1. **New Project** e conecte o repositório `Vingreyck/CT-Saude-Total`.
2. **+ New → Database → PostgreSQL.** O Railway cria a variável `DATABASE_URL` sozinho.
3. Crie **três serviços** apontando para o mesmo repositório. Em cada um, em **Settings**:

| Serviço | Root Directory | Config file path (Config-as-code) |
|---|---|---|
| `api` | deixe vazio | `/apps/api/railway.json` |
| `worker` | deixe vazio | `/apps/worker/railway.json` |
| `web` | deixe vazio | `/apps/web/railway.json` |

> O caminho do arquivo de configuração é **absoluto a partir da raiz do repositório** e não segue o Root Directory. Por isso começa com barra.

4. Em **Variables** de cada serviço, adicione `DATABASE_URL` com o valor `${{Postgres.DATABASE_URL}}` (referência ao serviço do banco, não o texto colado). Depois copie o resto do [.env.example](../.env.example).
5. No serviço `web`, **Settings → Networking → Generate Domain**.

### Duas coisas que evitam dor de cabeça

**Só o serviço `api` roda migration.** Isso já está no `apps/api/railway.json` (`migrate:deploy` antes do `start`). Se os três rodarem, eles competem pela mesma migration e o deploy falha de forma intermitente, difícil de diagnosticar.

**Cada serviço só rebuilda quando o que lhe interessa muda.** Os `watchPatterns` nos arquivos de config cuidam disso: mexer em `apps/web` não redeploya a `api`. Sem isso, todo commit dispara três builds.

### Conferindo que subiu

```bash
curl https://SEU-DOMINIO-DA-API/health
```

Deve responder `{"ok":true,...}`. Para a checagem que também testa o banco, use `/health/profundo`.

## 4. Antes do primeiro disparo real

Checklist que não é burocracia, é o que evita queimar o número da academia:

- [ ] `EVO_TOKEN` funcionando (`CT-010`)
- [ ] Número verificado no WhatsApp Business (`CT-020`)
- [ ] Templates aprovados pela Meta (`CT-024`)
- [ ] Nenhum texto mencionando "RN Movement"
- [ ] Política de privacidade publicada e base legal definida (`CT-007`)
- [ ] Opt-out testado de ponta a ponta
- [ ] Disparo de teste com no máximo 100 pessoas (`CT-036`)
- [ ] Teste cego do bot aprovado (ver [05-persona-bot.md](05-persona-bot.md), seção 8)

## 5. O que já está pronto no esqueleto

| Item | Onde | Estado |
|---|---|---|
| Modelo de dados das Sprints 1 a 5 | `packages/db/prisma/schema.prisma` | Pronto, migra e gera cliente |
| Pesquisa de satisfação no formato conversa | `packages/db/prisma/seed.ts` | 12 perguntas, núcleo + rodízio |
| Filtro de humanização | `packages/ai/src/humanizar.ts` | Pronto, 21 testes passando |
| Prompt de persona | `packages/ai/src/persona.ts` | Pronto, ajustar com conversa real |
| Provedor de IA (Sonnet 5 + Haiku 4.5) | `packages/ai/src/anthropic.ts` | Pronto, falta chave |
| Normalização de telefone | `packages/shared/src/telefone.ts` | Pronto, 8 testes passando |
| Regras da janela de 24h e horário | `packages/shared/src/janela.ts` | Pronto |
| Client do EVO com retry e paginação | `packages/evo/src/client.ts` | Pronto, tipos a confirmar na CT-010 |
| Canal WhatsApp Cloud API | `packages/whatsapp/src/cloud-api.ts` | Envio e webhook prontos |
| API com webhooks e healthcheck | `apps/api` | Recebe e valida assinatura, falta persistir |
| Worker com filas e crons | `apps/worker` | Sync do EVO pronto, resto é esqueleto |
| Painel | `apps/web` | Home com números reais, telas internas na Sprint 1 |

Os `TODO` no código estão marcados com o ID da história do backlog, então dá para ir do arquivo para o [02-backlog.md](02-backlog.md) e vice-versa.
