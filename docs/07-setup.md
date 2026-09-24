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

**Já está no ar.** Esta seção registra como ficou e como reproduzir.

| | |
|---|---|
| Projeto | `daring-truth` |
| Painel | https://ctweb-production-38bf.up.railway.app |
| API | https://ctapi-production.up.railway.app |
| Serviços | `@ct/api`, `@ct/worker`, `@ct/web`, `Postgres` |

### As três coisas que quebraram, e por quê

Anotado porque vai acontecer de novo em qualquer monorepo npm no Railway.

**1. O Railway detecta o monorepo sozinho e configura errado.** Ao importar o repositório, ele achou os 8 pacotes do workspace e criou um serviço por app já com o **Root Directory** apontando para a pasta do pacote. Com isso o build roda dentro de `apps/api`, onde não existe `package-lock.json` nem `packages/`, e o install quebra. **Root Directory tem que ficar vazio**, sempre. O que separa um serviço do outro são os comandos, não a pasta.

**2. O builder não é mais o Nixpacks, é o Railpack.** E o `railway.json` só é lido quando alguém preenche o caminho dele à mão nas configurações do serviço. Como isso não acontece sozinho, o arquivo era ignorado e o Railpack reclamava de `No start command detected`. Por isso os `railway.json` foram removidos: a configuração que vale está em [scripts/railway-setup.sh](../scripts/railway-setup.sh), via variáveis `RAILPACK_*`, que sempre valem e são reproduzíveis.

**3. O `prisma generate` precisa rodar no install, não no build.** O Railpack monta a imagem final copiando o `node_modules` da camada de **install**. O client do Prisma era gerado na camada de **build**, dentro de `node_modules`, e sumia. O container subia e morria com `@prisma/client did not initialize yet`. Por isso o install é `npm ci && npm run db:generate`.

### Reproduzir do zero

```bash
railway login && railway link
```

```bash
bash scripts/railway-setup.sh
```

Depois, em cada serviço, confira que **Root Directory está vazio** e gere os domínios:

```bash
railway domain --service "@ct/web" --port 3000
```

### Conferir que está de pé

```bash
curl https://ctapi-production.up.railway.app/health/profundo
```

Deve responder `{"ok":true,"banco":"conectado"}`.

### O que a API avisa no log, e é esperado

```
subindo com pendencias:
  EVO_TOKEN: sem ele nao da para puxar os alunos do EVO (CT-010)
  WHATSAPP_ACCESS_TOKEN: sem ele nao da para mandar nem receber mensagem (CT-020)
  ANTHROPIC_API_KEY: sem ela o bot nao conversa nem extrai informacao
```

A API sobe sem as três de propósito, para dar para ver o sistema de pé antes de ter token do EVO ou número verificado. Conforme cada uma chegar, é só adicionar:

```bash
railway variables --service "@ct/api" --set "EVO_TOKEN=cole-aqui"
```

## 3.1 A chave que liga e desliga o bot

`BOT_RESPONDE` vive no serviço `@ct/api`:

| Valor | O que acontece com uma mensagem que chega |
|---|---|
| `nao` (padrão) | Grava, casa com o aluno, abre a janela de 24h, registra opt-out e aparece na caixa de entrada. **Ninguém responde sozinho.** |
| `sim` | Tudo isso e o bot conduz a pesquisa. |

Ligar é uma variável, não é mexer em código:

```bash
railway variables --service "@ct/api" --set "BOT_RESPONDE=sim"
```

Desligar a qualquer momento é o mesmo comando com `nao`. O que já estava
gravado continua gravado: o interruptor decide se responde, nunca se coleta.

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
