# EVO API — referência do projeto

Estudo completo feito em 22/09/2026 sobre a especificação OpenAPI da EVO (132 caminhos, 147 operações, 29 recursos) e testado contra a base real do CT Saúde Total.

> **Como ler este documento:** o que está marcado **testado** foi verificado contra a API real da academia. O resto vem da especificação e pode não se comportar como o esperado. Essa distinção existe porque este projeto já perdeu tempo com suposição que a especificação desmentiu.

## 1. Acesso

| | |
|---|---|
| Base | `https://evo-integracao.w12app.com.br` |
| Autenticação | **Basic**: usuário é o **DNS da academia**, senha é a **chave** |
| DNS do CT | `saudetotalct` |
| Onde gerar | Painel EVO → engrenagem → Integração → **+** |
| Validade do token | 2 anos |
| Plano contratado | **EVO API Plus** (incluído no EVO Black) |

**testado** O header `Authorization` é `Basic base64(dns:chave)`. Colar a chave crua devolve 401.

## 2. Cota, e a conta que importa

| Limite | Valor |
|---|---|
| Por mês | 1.000 requisições |
| Por dia | 100 requisições |
| Por segundo | 5 (header `x-rate-limit-remaining`) |

A resposta traz `x-rate-limit-limit`, `x-rate-limit-remaining` e `x-rate-limit-reset`, e um header **`total`** com o tamanho total do conjunto, independente de quantos registros vieram.

### O erro que quase custou caro

A documentação em texto diz que a API "retorna 50 registros por vez". Isso é o **padrão**, não o máximo. A especificação diz:

> `take` — Total number of records to return. **(Maximum of 10000)**

Com 3.167 alunos, isso muda tudo:

| | Assumindo 50 por página | Real (10.000) |
|---|---|---|
| Requisições por sincronização | 64 | **1** |
| Sincronizando de 2 em 2 horas | impossível | **360/mês** |
| % da cota mensal | 192% | **36%** |

**Lição registrada: ler a especificação, não o texto de apoio.**

### Consumo planejado

| Job | Frequência | Req/mês |
|---|---|---|
| Sync de membros (incremental) | a cada 2h | 360 |
| Catraca | 1x por dia | 30 |
| Folga para campanhas e consultas | | ~600 |

## 3. Paginação e filtro incremental

`take` e `skip`. E o que resolve o problema de cota:

**`updateDate`** — "Filter only members that have update data greater than or equal".

**testado** Base inteira: 3.167 alunos. Alterados nos últimos 30 dias: 1.404. O filtro corta 56% do volume, e no recorte de 2 horas corta quase tudo.

É a prática padrão para API com cota, o mesmo mecanismo que Google e Microsoft usam: guarda-se a data da última leitura e pede-se só o que mudou depois dela.

## 4. Os endpoints que este projeto usa

### Membros

| Endpoint | Uso |
|---|---|
| `GET /api/v2/members` | **O principal.** Sync da base |
| `GET /api/v2/members/{idMember}` | Perfil completo de um aluno |
| `GET /api/v1/members/basic` | Versão leve, quando só precisar de nome e contato |
| `POST /api/v1/members/multiple-push` | Push pelo app do EVO. Canal alternativo e gratuito |

Parâmetros de `/api/v2/members` que interessam:

| Parâmetro | Para quê |
|---|---|
| `take` / `skip` | Paginação. Máximo 10.000 |
| `updateDate` | Só quem mudou desde a data |
| `status` | 1 = ativo (inclui suspensos e VIPs), 2 = inativo |
| `showMemberships` | **Precisa ser `true`**, senão não vem contrato nenhum |
| `showActivityData` | Dados de atividade do aluno |
| `registerDateStart` / `End` | Filtro por data de matrícula |
| `membershipCancelDateStart` / `End` | Quem cancelou no período. Serve para campanha de retorno |
| `phone`, `email`, `document` | Busca pontual |

### A armadilha dos campos

**testado** O retorno **não tem** `cellphone` nem `contracts`, que eram o que eu tinha assumido:

```
contacts:    [{ idPhone, idContactType, contactType, ddi, description }]
memberships: [{ idMembership, name, startDate, endDate, membershipStatus, cancelDate, ... }]
```

- O telefone fica em **`contacts[].description`**, misturado com e-mail, e o tipo vem como **texto livre** em `contactType`.
- Por isso `telefonesDoMembro()` testa todos os contatos e fica com o primeiro que normaliza para celular válido, em vez de confiar no rótulo.
- `memberships` só vem se `showMemberships=true`.

Outros campos úteis: `lastAccessDate`, `birthDate`, `status`, `membershipStatus`, `accessBlocked`, `blockedReason`, `photoUrl`, `whatsappUsername`, `totalFitCoins`.

### Catraca

**testado** `GET /api/v1/entries` funciona no plano Plus. Nos últimos 7 dias: **7.030 entradas**, cerca de mil por dia.

| Parâmetro | |
|---|---|
| `registerDateStart` / `registerDateEnd` | Janela de datas |
| `take` / `skip` | Até 10.000 |
| `idMember` | Histórico de um aluno |

Campos: `date`, `dateTurn`, `idMember`, `nameMember`, `idProspect`, `idEmployee`, `entryType`, `device`, `entryAction`, `blockReason`, `idTurnstile`, `idBranch`.

**Isso destrava o CT-016 e o CT-070 sem depender de webhook.** E cada aluno ainda traz `lastAccessDate` no próprio cadastro, que serve de atalho.

### Webhook

**testado** `GET /api/v2/webhook` responde **HTTP 200** no plano Plus, com 0 webhooks cadastrados.

A central de ajuda diz que webhook é do plano Pro, mas isso se refere à **aba Webhook Pro da interface**. O endpoint da API responde.

| Endpoint | |
|---|---|
| `GET /api/v2/webhook` | Lista os cadastrados |
| `POST /api/v1/webhook` | Cria. Corpo: `idBranch`, `eventType`, `urlCallback`, `headers[]`, `filters[]` |
| `DELETE /api/v1/webhook` | Remove por id |

**Ainda não testado:** se o `POST` de fato cria. Ler a lista funcionar não prova que escrever funciona. Esse teste altera a configuração de produção do EVO, então fica para quando o épico chegar, com o dono avisado.

### Outros recursos mapeados

| Recurso | Ops | Onde entra no backlog |
|---|---|---|
| Activities | 19 | Aulas e reservas (E8) |
| Receivables | 12 | Financeiro (E9) |
| Prospects | 8 | Campanha para quem não fechou |
| Appointments | 7 | Agendamento |
| Employees | 5 | Gamificação (E12) |
| Sales | 5 | Financeiro |
| MemberMembership | 4 | Contratos e cancelamento |
| Management | 4 | `not-renewed` dá a lista de não renovados pronta |
| Notifications | 2 | Escrever nota no cadastro do aluno dentro do EVO |
| Invoices | 1 | Faturas |

**testado** `GET /api/v2/management/activeclients` respondeu 200 mas com 0 registros. Para segmentar ativos, use `/api/v2/members?status=1`.

## 5. Descobertas que mudaram decisões

| Descoberta | Efeito |
|---|---|
| `take` vai até 10.000 | Sync passou de 64 requisições para 1. Plano Pro deixou de ser necessário |
| `updateDate` existe | Sync incremental, de 2 em 2 horas |
| `showMemberships` vem desligado | Sem ele o campo plano ficava sempre vazio, e ninguém perceberia |
| Telefone está em `contacts`, não em `cellphone` | O sync não teria achado telefone nenhum |
| `/api/v1/entries` funciona no Plus | Lembrete de ausência não depende de webhook |
| Webhook responde no Plus | A recomendação de gastar com o Pro caiu |

## 6. O que ainda não sei

Registrado como dívida, não como conhecimento:

- Se `POST /api/v1/webhook` funciona no plano Plus, e quais `eventType` existem.
- Se a cota de 100/dia é por token ou por academia.
- O que acontece exatamente ao estourar a cota: se é 429 ou 403, e o que vem no corpo.
- Se `take=10000` degrada o tempo de resposta a ponto de estourar timeout. O sync usa 1.000 por página por precaução.
