# Plano de Sprints

**Este documento é a alocação oficial.** A coluna Sprint do [02-backlog.md](02-backlog.md) segue exatamente o que está aqui.

## Premissas

- **1 pessoa desenvolvendo**, com assistência de IA no código.
- **Sprint de 2 semanas.**
- **Capacidade assumida: 45 a 50 pontos por sprint.** Isso é um chute inicial, não uma medição. Depois da Sprint 1 a velocidade real aparece, e o plano se recalibra a partir dela. Se a Sprint 1 fechar em 30 pontos, todo o calendário abaixo estica proporcionalmente e isso é informação boa, não fracasso.
- Total do backlog atual: **471 pontos**.

## O ajuste mais importante deste plano

Você pediu "Sprint 1: disparo em massa e coleta de info". Colocando critério de aceite em cada pedaço, isso soma **142 pontos**: sincronizar o EVO, subir o canal oficial do WhatsApp, construir o bot com IA, rodar a pesquisa inteira, gravar tudo estruturado, montar o motor de campanha com throttle e idempotência, e ainda entregar o painel para o dono ler as conversas.

Cabe em **três sprints, cerca de seis semanas**, não em duas semanas. Então estou chamando esse conjunto de **Ciclo 1**, e quebrando em três sprints que entregam valor visível em cada uma. O escopo que você pediu está inteiro, só distribuído de forma honesta.

Se seis semanas for inaceitável para o dono, o corte que eu recomendo é o Sprint 3 virar campanha manual: dispara por lista fixa, sem construtor de campanha no painel. Isso tira ~16 pontos e adianta uma semana. Não recomendo cortar nada da coleta nem do painel de leitura, porque é exatamente ali que está o valor que o dono comprou.

---

## Ciclo 0 — Preparação (18/09 a 21/09) · 26 pts · custo zero

**Objetivo:** chegar na segunda com tudo destravado, sem gastar nada.

Esta é a semana em que nada é pago e nada precisa ser. É acesso, conta e decisão.

| ID | O que | Observação |
|---|---|---|
| CT-010 | Validar token, escopo e rate limit da API do EVO | **Bloqueante. Faça isso primeiro.** Se o plano contratado não liberar API, o projeto inteiro muda de forma |
| CT-020 | Abrir e verificar o WhatsApp Business do CT | A verificação da Meta leva dias. Começar agora é o que evita a Sprint 1 travar esperando |
| CT-007 | Escrever política de privacidade, bases legais e texto de consentimento | Precisa estar pronto antes do primeiro disparo, não depois |
| CT-001 a CT-005 | Monorepo, Postgres no Railway, deploy automático, fila e logs | Railway e Postgres no plano gratuito ou de baixo custo até a segunda |

**Decisões que você precisa tomar nesta semana:**

1. **Qual LLM conduz o bot.** Comparativo em [04-comparativo-ia.md](04-comparativo-ia.md).
2. **Cloud API oficial ou Evolution API** para o disparo. Recomendação em [01-arquitetura.md](01-arquitetura.md), seção 6.
3. **A pesquisa no WhatsApp continua anônima?** O formulário atual promete anonimato, mas no WhatsApp o número identifica a pessoa. Ver [06-pesquisa-satisfacao.md](06-pesquisa-satisfacao.md), seção 2.

**Definição de pronto do ciclo:** `git push` na main sobe api, worker e web no Railway; token do EVO retorna a lista real de alunos; WhatsApp Business em verificação.

---

## Ciclo 1 — Chatbot, disparo e coleta (Sprints 1 a 3)

### Sprint 1 · 21/09 a 02/10 · 47 pts · "O tubo ligado"

**Meta:** a base do EVO está espelhada, o número oficial fala e ouve, e o dono lê a conversa no painel.

`CT-006` auth com papéis · `CT-011` client EVO · `CT-012` sync diário de membros · `CT-013` telefones em E.164 · `CT-014` segmentos ativo, inativo e prospect · `CT-021` interface de canal + driver oficial · `CT-022` webhook de mensagens e status · `CT-023` janela de serviço de 24h · `CT-024` templates aprovados · `CT-061` lista de clientes · `CT-063` leitura de conversas

**Demo de fim de sprint:** o dono entra no painel, vê todos os alunos ativos vindos do EVO com telefone válido e o percentual de cobertura de contato. Manda uma mensagem pelo número oficial, responde do celular dele, e a conversa aparece no painel em segundos.

**Métrica que sai daqui:** cobertura de contato. Se der abaixo de 70%, a primeira campanha real muda de objetivo e vira atualização cadastral.

### Sprint 2 · 05/10 a 16/10 · 47 pts · "O bot que conversa e coleta"

**Meta:** a pesquisa de satisfação roda inteira no WhatsApp e cai estruturada no banco.

`CT-040` interface de provedor de IA · `CT-041` persona humanizada · `CT-042` filtro determinístico anti-IA · `CT-043` contexto da conversa · `CT-044` ritmo humano de digitação · `CT-045` guardrails de escopo e honestidade · `CT-050` pesquisa completa no WhatsApp · `CT-051` gravação estruturada · `CT-052` NPS calculado · `CT-053` extração de categoria, sentimento e entidades

**Demo de fim de sprint:** dez pessoas reais (equipe, amigos, alunos voluntários) fazem a pesquisa inteira pelo WhatsApp. O banco tem nota por item, NPS calculado, e cada texto livre já classificado por categoria e sentimento.

**Teste cego obrigatório antes de fechar a sprint:** mostrar cinco conversas para o dono sem avisar quais são do bot. Se ele acertar todas, o filtro de humanização ainda não está pronto.

### Sprint 3 · 19/10 a 30/10 · 48 pts · "Disparo em massa e o painel do dono"

**Meta:** campanha real para a base toda, resultado consolidado na tela.

`CT-030` construtor de campanha · `CT-031` disparo com throttle e idempotência · `CT-032` janela de horário e bloqueio de opt-out · `CT-033` resultado da campanha · `CT-034` opt-out por palavra · `CT-036` disparo de teste obrigatório · `CT-060` home do painel · `CT-062` ficha do cliente · `CT-064` respostas consolidadas

**Demo de fim de sprint:** campanha de feedback disparada de verdade. Primeiro lote de 100 pessoas, leitura dos números, depois a base completa. O dono abre o painel e vê NPS, média por item avaliado e a lista de respostas abertas filtrável por categoria.

**Fim do Ciclo 1. É aqui que o que você chamou de "Sprint 1" está entregue.**

---

## Ciclo 2 — Retenção e inteligência (Sprints 4 e 5)

### Sprint 4 · 02/11 a 13/11 · 42 pts · "Retenção automática"
> 02/11 é Finados. Considere no planejamento.

`CT-016` histórico de catraca · `CT-070` lembrete no 3º dia de ausência · `CT-071` motivo de quem sumiu, classificado · `CT-035` aniversário automático · `CT-054` retomada de pesquisa incompleta · `CT-055` alerta de nota crítica · `CT-047` classificação de intenção · `CT-046` atendente assume a conversa · `CT-037` pausar campanha · `CT-025` transcrição de áudio

**Demo:** aluno para de ir, no terceiro dia recebe mensagem, responde o motivo, e o motivo aparece classificado no painel. Nota 1 em limpeza gera alerta na hora.

### Sprint 5 · 16/11 a 27/11 · 49 pts · "Inteligência sobre o cliente"

`CT-015` webhooks do EVO · `CT-057` perfil enriquecido por conversa · `CT-058` captura de perfil sem cara de formulário · `CT-059` exportação · `CT-065` ranking de temas · `CT-056` pesquisas editáveis sem deploy · `CT-066` lista de risco de cancelamento · `CT-072` régua escalonada de reengajamento · `CT-073` medição do lembrete contra grupo de controle

**Demo:** o dono cria uma pergunta nova sozinho, dispara, e no dia seguinte vê o ranking do que mais apareceu nas respostas. E abre a lista de quem está prestes a sair.

---

## Ciclo 3 — Operação (Sprints 6 a 9)

| Sprint | Período | Pts | Tema | Entrega |
|---|---|---|---|---|
| 6 | 30/11 a 11/12 | 33 | Reservas | Recovery e quadra reserváveis pelo WhatsApp, agenda no painel, regras configuráveis, sem overbooking |
| 7 | jan/2027 | 37 | Financeiro | Receita, inadimplência, régua de cobrança automática, DRE simplificado, MRR e churn |
| 8 | jan/2027 | 41 | BI e chamados | Dashboard executivo, série de NPS, mapa de calor de frequência, resumo semanal automático, chamados e alarme operacional |
| 9 | fev/2027 | 42 | Operação interna | Chat interno por função com ADM vendo tudo, escala de turnos, ponto, troca de turno, consulta em linguagem natural |

> Recesso de 21/12 a 02/01. As datas a partir da Sprint 7 são sequenciais e só se firmam depois de medir a velocidade real nas três primeiras sprints.

---

## Ciclo 4 — Engajamento e app (Sprints 10 e 11)

| Sprint | Pts | Tema | Entrega |
|---|---|---|---|
| 10 | 23 | Gamificação | Pontos por indicação e contrato fechado, rastreio de origem da indicação, ranking mensal, cálculo de bonificação |
| 11 | 36 | App do cliente | Login pelo cadastro do EVO, reservas, avisos por push, frequência, pesquisa e financeiro |

A loja de comida (CT-140, CT-141) fica no backlog sem sprint. Primeiro passo é uma reunião com o restaurante para descobrir quem cobra, quem entrega e se existe comissão. Sem isso, qualquer estimativa é invenção.

---

## Como a sala Recovery aparece antes do app existir

Você levantou isso na reunião e a resposta é: **pelo chatbot, sim, e é melhor assim.**

1. **Aluno reserva pelo WhatsApp** conversando com o bot (CT-080). Não precisa instalar nada, e é o canal que as pessoas já abrem.
2. **Atendente e gerente veem e gerenciam a agenda no painel web** (CT-081), que é onde a operação já vai estar olhando.
3. Quando o app chegar (CT-131), ele consome **a mesma regra de negócio**, sem duplicar lógica de disponibilidade e concorrência.

O app vira mais um canal para a mesma agenda, não uma segunda agenda. Por isso CT-080 e CT-081 vêm antes e CT-131 é barato depois.

---

## Ritual mínimo de sprint

Com uma pessoa só, cerimônia demais é desperdício. O mínimo que vale:

- **Planejamento (1h, segunda de início):** confirmar o escopo da sprint e cortar o que não cabe, antes de começar, não no meio.
- **Demo com o dono (30 min, sexta de fim):** mostrar funcionando, não contar. Toda sprint tem uma demo que ele consegue abrir e mexer.
- **Ajuste de backlog (30 min, logo após a demo):** o que ele falar na demo entra no backlog na hora, priorizado pela regra do dado.

Sem daily. Com uma pessoa, daily é conversa consigo mesmo.

## Definição de pronto (vale para toda história)

1. Funciona em produção no Railway, não só na máquina local.
2. Tem teste automatizado no caminho crítico (disparo, opt-out, gravação de resposta e idempotência são inegociáveis).
3. Erro é logado com contexto suficiente para investigar sem reproduzir.
4. Se toca dado pessoal, respeita opt-out e a base legal declarada.
5. Se gera dado, ele está **estruturado e consultável**, não só em texto livre.
6. O dono consegue ver o resultado em alguma tela.
