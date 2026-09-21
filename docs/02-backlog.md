# Backlog do Produto — CT Saúde Total

**Legenda de prioridade (MoSCoW):** `M` must have · `S` should have · `C` could have · `W` won't have agora
**Estimativa:** pontos de história (1 = algumas horas, 3 = um dia, 5 = dois a três dias, 8 = quase uma semana, 13 = precisa ser quebrada)

Regra de desempate deste backlog: **entre duas histórias de valor parecido, ganha a que gera mais dado estruturado sobre o cliente.**

---

## E0. Plataforma e Fundação

| ID | História | Critérios de aceite | Pri | Pts | Sprint |
|---|---|---|---|---|---|
| CT-001 | Como dev, quero o monorepo criado com apps e packages para começar a codar sem discutir estrutura | npm workspaces; apps `api`, `worker`, `web`; packages `db`, `shared`, `evo`, `whatsapp`, `ai`; lint e format configurados; build passa | M | 3 | 0 |
| CT-002 | Como dev, quero Postgres provisionado no Railway com migrations versionadas | serviço Postgres no Railway; Prisma conectado; `migrate dev` e `migrate deploy` funcionando; `.env.example` completo | M | 3 | 0 |
| CT-003 | Como dev, quero deploy automático dos 4 serviços no Railway a partir da `main` | push na `main` sobe `api`, `worker` e `web`; healthcheck em `/health`; variáveis separadas por ambiente | M | 5 | 0 |
| CT-004 | Como dev, quero fila e cron rodando no worker | pg-boss instalado; um job de teste enfileirado e processado; um cron de teste executando; retry com backoff exponencial configurado | M | 5 | 0 |
| CT-005 | Como dev, quero logs estruturados e captura de erro | pino com correlationId por requisição e por job; Sentry recebendo exceções de api e worker | S | 2 | 0 |
| CT-006 | Como ADM, quero login com papéis para que cada função veja só o que lhe cabe | papéis `adm`, `gerente`, `professor`, `atendente`; guard de rota na API e no painel; ADM enxerga tudo | M | 5 | 1 |
| CT-007 | Como responsável pelo dado, quero a política de privacidade e as bases legais escritas antes do primeiro disparo | documento com finalidade, base legal e prazo de retenção por tipo de dado; texto de consentimento aprovado pelo dono | M | 3 | 0 |

---

## E1. Integração com o EVO

| ID | História | Critérios de aceite | Pri | Pts | Sprint |
|---|---|---|---|---|---|
| CT-010 | Como dev, quero validar acesso, escopo e rate limit da API do EVO antes de planejar o resto | token emitido; chamada real a `/api/v1/members` retornando dados; rate limit documentado; confirmado se catraca vem por consulta ou só por webhook | M | 2 | 0 |
| CT-011 | Como sistema, quero um client tipado do EVO com retry e tratamento de rate limit | package `evo` com métodos tipados; backoff em 429; timeouts; logs de consumo por endpoint | M | 5 | 1 |
| CT-012 | Como sistema, quero sincronizar a base de membros do EVO todo dia | cron diário + gatilho manual; upsert por `id_evo`; guarda `sincronizado_em` e payload bruto; relatório de quantos criados, atualizados e com erro | M | 5 | 1 |
| CT-013 | Como sistema, quero normalizar telefones para E.164 e marcar os inválidos | todo telefone salvo em E.164 (+55...); número inválido ou ausente marcado e excluído dos disparos; relatório de cobertura de contato | M | 3 | 1 |
| CT-014 | Como sistema, quero identificar quem está ativo, inativo e prospect | status derivado do EVO em campo próprio; segmentos consultáveis; regra documentada | M | 3 | 1 |
| CT-015 | Como sistema, quero receber webhooks do EVO para refletir mudanças em tempo real | endpoint `/webhooks/evo` com validação de assinatura; eventos de cadastro e contrato aplicados; payload bruto arquivado | S | 5 | 5 |
| CT-016 | Como sistema, quero importar o histórico de catraca | check-ins gravados com data, hora e membro; carga inicial dos últimos 90 dias; atualização diária | M | 5 | 4 |

---

## E2. Canal de WhatsApp

| ID | História | Critérios de aceite | Pri | Pts | Sprint |
|---|---|---|---|---|---|
| CT-020 | Como dono, quero um número oficial do CT Saúde Total no WhatsApp Business | Business Manager verificado; número dedicado; perfil com nome, foto, endereço e horário preenchidos | M | 3 | 0 |
| CT-021 | Como dev, quero a interface `CanalWhatsapp` com implementação oficial e implementação de testes | interface única; driver Cloud API; driver Evolution API para dev; troca por variável de ambiente | M | 5 | 1 |
| CT-022 | Como sistema, quero receber mensagens, status e mídia por webhook | `/webhooks/whatsapp` validando assinatura; texto, áudio e imagem normalizados; eventos de entregue, lido e falha gravados | M | 5 | 1 |
| CT-023 | Como sistema, quero controlar a janela de serviço de 24h por conversa | `janela_servico_expira_em` atualizado a cada mensagem do cliente; envio livre dentro da janela; fora dela, só template | M | 3 | 1 |
| CT-024 | Como dono, quero templates aprovados para abertura de conversa | pelo menos 4 templates aprovados: feedback, aniversário, aviso geral, ausência; cada um classificado como marketing ou utility com o custo anotado | M | 3 | 1 |
| CT-025 | Como sistema, quero transcrever áudios recebidos | áudio vira texto e segue o mesmo fluxo de extração; original guardado; falha de transcrição não derruba a conversa | S | 3 | 4 |

---

## E3. Motor de Campanhas e Disparo em Massa

| ID | História | Critérios de aceite | Pri | Pts | Sprint |
|---|---|---|---|---|---|
| CT-030 | Como dono, quero criar uma campanha escolhendo público, template e horário | seleção por segmento (ativos, inativos, prospects, aniversariantes, ausentes); preview da mensagem com variáveis reais; agendamento com data e hora | M | 8 | 3 |
| CT-031 | Como sistema, quero disparar em lote com throttling e sem duplicar | fila com taxa configurável por minuto; chave idempotente `campanha_id + membro_id`; reprocessar a fila nunca reenvia | M | 8 | 3 |
| CT-032 | Como sistema, quero respeitar janela de horário e opt-out | nenhum envio fora de 08:00 às 20:00; quem está em opt-out nunca entra no lote, com bloqueio em nível de banco | M | 3 | 3 |
| CT-033 | Como dono, quero ver o resultado de cada campanha | painel com enviados, entregues, lidos, respondidos, falhas e opt-outs; custo estimado da campanha | M | 5 | 3 |
| CT-034 | Como aluno, quero conseguir sair da lista com uma palavra | "parar", "sair", "cancelar" e variações encerram tudo na hora; confirmação enviada; opt-out registrado com data e origem | M | 3 | 3 |
| CT-035 | Como sistema, quero disparar felicitação de aniversário automaticamente | cron diário; template de aniversário; sem duplicar no mesmo ano; respeita opt-out | M | 3 | 4 |
| CT-036 | Como dono, quero fazer teste com um grupo pequeno antes de mandar para todos | modo "disparo de teste" com lista limitada; exige aprovação explícita para liberar o lote completo | M | 3 | 3 |
| CT-037 | Como sistema, quero pausar uma campanha em andamento | botão de pausa que interrompe a fila em segundos; retomada continua de onde parou sem reenviar | S | 3 | 4 |

---

## E4. Chatbot Humanizado

| ID | História | Critérios de aceite | Pri | Pts | Sprint |
|---|---|---|---|---|---|
| CT-040 | Como dev, quero a interface `ProvedorIA` para trocar de LLM sem reescrever o bot | interface única de chat e de extração estruturada; implementação do provedor escolhido; troca por variável de ambiente | M | 5 | 2 |
| CT-041 | Como aluno, quero conversar com alguém que parece gente do CT | prompt de persona aplicado; mensagens curtas, uma pergunta por vez, PT-BR coloquial; ver [05-persona-bot.md](05-persona-bot.md) | M | 5 | 2 |
| CT-042 | Como dono, quero que o bot nunca soe como robô de IA | filtro determinístico de pós-processamento: remove travessão, limita emoji, quebra parágrafo longo, corta abertura corporativa; testes automatizados cobrindo cada regra | M | 3 | 2 |
| CT-043 | Como sistema, quero manter contexto da conversa entre mensagens | histórico da conversa carregado a cada turno com limite de tokens; retomada correta depois de horas de silêncio | M | 5 | 2 |
| CT-044 | Como sistema, quero simular ritmo humano de digitação | indicador de digitando; atraso proporcional ao tamanho da mensagem, com teto; mensagem longa quebrada em duas | S | 2 | 2 |
| CT-045 | Como sistema, quero um guardrail de escopo e de honestidade | o bot não fala de preço, contrato nem assunto médico sem encaminhar para humano; se perguntarem direto se é robô, ele não mente; nunca inventa informação da academia | M | 3 | 2 |
| CT-046 | Como atendente, quero assumir a conversa quando necessário | botão de "assumir" no painel; bot silencia enquanto humano está no controle; devolução explícita | S | 5 | 4 |
| CT-047 | Como sistema, quero classificar a intenção de toda mensagem recebida | toda mensagem entra com intenção classificada (feedback, dúvida, reclamação, agendamento, comercial, outro); usada para roteamento e para o painel | M | 5 | 4 |

---

## E5. Coleta de Dados e Pesquisa  ★ prioridade máxima

| ID | História | Critérios de aceite | Pri | Pts | Sprint |
|---|---|---|---|---|---|
| CT-050 | Como dono, quero a pesquisa de satisfação rodando dentro do WhatsApp | roteiro completo de [06-pesquisa-satisfacao.md](06-pesquisa-satisfacao.md); uma pergunta por mensagem; aceita resposta fora do formato e reinterpreta; permite pular pergunta | M | 8 | 2 |
| CT-051 | Como sistema, quero gravar toda resposta em formato estruturado | nota vira inteiro, opção vira enum, texto vira texto mais extração; nada fica só como texto solto; schema validado antes de gravar | M | 5 | 2 |
| CT-052 | Como dono, quero o NPS calculado automaticamente | promotores, neutros e detratores segundo a régua padrão; NPS do período e evolução mês a mês | M | 3 | 2 |
| CT-053 | Como sistema, quero extrair categoria, sentimento e entidades de todo texto livre | job de extração devolvendo JSON validado: categoria, sentimento, urgência, entidades (equipamento, professor, horário, local) e tags; taxonomia versionada | M | 8 | 2 |
| CT-054 | Como dono, quero retomar quem começou e não terminou a pesquisa | lembrete único após 24h dentro da janela ou por template; retomada do ponto onde parou; no máximo um lembrete por pessoa | S | 3 | 4 |
| CT-055 | Como dono, quero um alerta imediato quando alguém der nota crítica | nota ≤ 2 em qualquer item ou NPS ≤ 6 gera alerta no painel e notificação; resposta marcada como prioridade de retorno | M | 5 | 4 |
| CT-056 | Como dono, quero perguntar coisas novas sem precisar de deploy | pesquisas e perguntas cadastráveis no painel, com versionamento; respostas antigas continuam ligadas à versão da pesquisa que responderam | S | 8 | 5 |
| CT-057 | Como dono, quero o perfil de cada aluno enriquecido pelas conversas | ficha do aluno mostra tags acumuladas, temas recorrentes, sentimento médio e histórico de notas | M | 5 | 5 |
| CT-058 | Como sistema, quero capturar dado de perfil no meio da conversa, sem soar como formulário | objetivo, horário preferido, modalidade favorita e como conheceu a academia capturados de forma conversacional e gravados em campo próprio | M | 5 | 5 |
| CT-059 | Como dono, quero exportar tudo que foi coletado | exportação CSV e XLSX por período, por segmento e por campanha | S | 3 | 5 |

---

## E6. Painel Web do Dono

| ID | História | Critérios de aceite | Pri | Pts | Sprint |
|---|---|---|---|---|---|
| CT-060 | Como dono, quero abrir um painel e ver o essencial na primeira tela | totais de alunos ativos, contatos válidos, respostas coletadas, NPS atual e alertas críticos abertos | M | 5 | 3 |
| CT-061 | Como dono, quero listar e buscar clientes | lista com busca por nome e telefone, filtro por status, plano e tags; paginada | M | 5 | 1 |
| CT-062 | Como dono, quero abrir a ficha de um cliente e ver tudo dele | dados do EVO, consentimento, histórico de campanhas, respostas, tags e insights | M | 5 | 3 |
| CT-063 | Como dono, quero ler as conversas do WhatsApp | thread completa em ordem, com mídia e status de entrega; busca por texto dentro das conversas | M | 5 | 1 |
| CT-064 | Como dono, quero ver as respostas da pesquisa consolidadas | média por item avaliado, distribuição de notas, NPS e lista de respostas abertas com filtro por categoria e sentimento | M | 8 | 3 |
| CT-065 | Como dono, quero ver o que mais aparece nas respostas abertas | ranking de categorias e tags no período; clicar abre as respostas originais que sustentam o número | M | 5 | 5 |
| CT-066 | Como dono, quero ver quem está prestes a sair | lista de risco combinando ausência, NPS baixo e reclamação recente, ordenada por risco | S | 8 | 5 |

---

## E7. Retenção e Ausência

| ID | História | Critérios de aceite | Pri | Pts | Sprint |
|---|---|---|---|---|---|
| CT-070 | Como dono, quero que quem não aparece há 3 dias receba uma mensagem | cron diário sobre os check-ins; limiar configurável; template classificado como utility; no máximo uma mensagem por período de ausência | M | 5 | 4 |
| CT-071 | Como dono, quero saber o motivo de quem sumiu | resposta ao lembrete vira conversa curta com motivo classificado (lesão, tempo, preço, desmotivação, mudança, outro) | M | 5 | 4 |
| CT-072 | Como dono, quero escalonar a régua de reengajamento | mensagens em 3, 7, 15 e 30 dias com tom e oferta diferentes; para na hora em que a pessoa volta a passar na catraca | S | 5 | 5 |
| CT-073 | Como dono, quero medir se o lembrete funciona | taxa de retorno em até 7 dias dos que receberam, comparada com grupo de controle | S | 5 | 5 |

---

## E8. Agendamento e Reservas

| ID | História | Critérios de aceite | Pri | Pts | Sprint |
|---|---|---|---|---|---|
| CT-080 | Como aluno, quero reservar a sala Recovery pelo WhatsApp | bot mostra horários livres, confirma reserva, envia lembrete e permite cancelar; sem overbooking, com trava de concorrência | M | 8 | 6 |
| CT-081 | Como atendente, quero ver e gerenciar a agenda do Recovery no painel | visão de dia e semana; criar, remarcar e cancelar; bloquear horário para manutenção | M | 5 | 6 |
| CT-082 | Como dono, quero configurar as regras da sala Recovery | duração do slot, capacidade simultânea, antecedência mínima e máxima, limite por aluno por semana, horário de funcionamento | M | 5 | 6 |
| CT-083 | Como aluno, quero reservar a quadra de areia parceira | mesmo fluxo do Recovery, com calendário e regras próprias da quadra; modalidade informada na reserva | S | 5 | 6 |
| CT-084 | Como dono, quero que o no-show tenha consequência | marcação de comparecimento; contagem de faltas; bloqueio temporário configurável após N faltas | C | 5 | 6 |
| CT-085 | Como sistema, quero refletir a reserva no EVO quando fizer sentido | avaliar `POST /api/v2/activities/booking`; se o EVO for a agenda oficial, ele vira a fonte da verdade e nós só orquestramos | S | 5 | 6 |

---

## E9. Financeiro Automatizado

| ID | História | Critérios de aceite | Pri | Pts | Sprint |
|---|---|---|---|---|---|
| CT-090 | Como dono, quero ver receita, inadimplência e previsão sem abrir o EVO | sincronismo de contas a receber e faturas; painel com recebido, a receber, vencido e previsto do mês | M | 8 | 7 |
| CT-091 | Como sistema, quero cobrar automaticamente quem está em atraso | régua de cobrança por WhatsApp em D+1, D+5 e D+15, com link de pagamento; para de cobrar assim que baixa | M | 8 | 7 |
| CT-092 | Como dono, quero acompanhar entradas, saídas e margem | lançamento de despesas por categoria; DRE simplificado mensal | S | 8 | 7 |
| CT-093 | Como dono, quero ver churn e receita recorrente | MRR, churn mensal, ticket médio e tempo médio de permanência | S | 5 | 7 |
| CT-094 | Como dono, quero conciliar o que entrou de verdade | conciliação entre baixa no EVO e extrato; divergências listadas | C | 8 | 7 |

---

## E10. BI e Dashboards

| ID | História | Critérios de aceite | Pri | Pts | Sprint |
|---|---|---|---|---|---|
| CT-100 | Como dono, quero um dashboard executivo com o que importa | alunos ativos, entradas e saídas do mês, frequência média, NPS, receita e alertas críticos, tudo em uma tela | M | 8 | 8 |
| CT-101 | Como dono, quero ver como a satisfação evolui | série histórica de NPS e das notas por item avaliado, com comparação entre períodos | M | 5 | 8 |
| CT-102 | Como dono, quero entender os horários de pico | mapa de calor de frequência por dia e faixa horária a partir da catraca | S | 5 | 8 |
| CT-103 | Como dono, quero receber um resumo semanal automático | mensagem ou e-mail toda segunda com números da semana e os 3 pontos que mais apareceram nas respostas abertas | S | 5 | 8 |
| CT-104 | Como dono, quero perguntar em linguagem natural sobre a base | pergunta em texto vira consulta e resposta com número e fonte; somente leitura, restrito ao ADM | C | 13 | 9 |

---

## E11. Operação Interna

| ID | História | Critérios de aceite | Pri | Pts | Sprint |
|---|---|---|---|---|---|
| CT-110 | Como atendente, quero abrir um chamado quando algo quebra ou suja | tipo, local, descrição, foto e prioridade; chamado criado em segundos | M | 5 | 8 |
| CT-111 | Como equipe, quero ser avisado na hora que um chamado é aberto | notificação para os papéis responsáveis pelo tipo do chamado, com o ADM sempre incluído | M | 5 | 8 |
| CT-112 | Como gerente, quero acompanhar o ciclo do chamado | estados aberto, em andamento e resolvido; responsável; tempo de resolução medido | M | 5 | 8 |
| CT-113 | Como equipe, quero um alarme para urgência real | prioridade urgente dispara notificação imediata e fica destacada até alguém assumir | M | 3 | 8 |
| CT-114 | Como funcionário, quero um chat interno separado por função | canais por função e canal geral; ADM lê todos os canais; histórico pesquisável | S | 8 | 9 |
| CT-115 | Como gerente, quero montar a escala de turnos dos professores | grade semanal por professor; turnos alternados; conflito detectado na hora | M | 8 | 9 |
| CT-116 | Como professor, quero registrar entrada e saída | ponto por turno; espelho mensal; ADM vê horas trabalhadas e faltas | S | 5 | 9 |
| CT-117 | Como professor, quero pedir troca de turno com outro colega | pedido, aceite do colega e aprovação do gerente; escala atualizada automaticamente | C | 5 | 9 |

---

## E12. Gamificação e Bonificação

| ID | História | Critérios de aceite | Pri | Pts | Sprint |
|---|---|---|---|---|---|
| CT-120 | Como dono, quero pontuar indicações e contratos fechados | regras configuráveis de pontos por evento; pontuação creditada ao atendente ou professor responsável | M | 8 | 10 |
| CT-121 | Como sistema, quero identificar a origem da indicação | aluno indicado informa quem indicou, ou link e código próprio de cada funcionário; crédito automático | M | 5 | 10 |
| CT-122 | Como equipe, quero ver o ranking do mês | ranking por função com pontos e posição; histórico dos meses anteriores | S | 5 | 10 |
| CT-123 | Como dono, quero calcular a bonificação do período | fechamento mensal com pontos, regra de bonificação e valor a pagar por pessoa | S | 5 | 10 |

---

## E13. App do Cliente

| ID | História | Critérios de aceite | Pri | Pts | Sprint |
|---|---|---|---|---|---|
| CT-130 | Como aluno, quero entrar no app com meu cadastro do CT | autenticação ligada ao cadastro do EVO; recuperação de acesso | M | 8 | 11 |
| CT-131 | Como aluno, quero ver disponibilidade e reservar Recovery e quadra | mesma regra de negócio das reservas do WhatsApp, sem duplicar lógica | M | 8 | 11 |
| CT-132 | Como aluno, quero receber avisos da academia | push de avisos gerais e lembretes; respeitando preferência de notificação | M | 5 | 11 |
| CT-133 | Como aluno, quero ver minha frequência e evolução | check-ins do mês, sequência e comparação com o próprio histórico | S | 5 | 11 |
| CT-134 | Como aluno, quero responder pesquisas pelo app também | mesma pesquisa do WhatsApp, mesma gravação estruturada | S | 5 | 11 |
| CT-135 | Como aluno, quero ver meu financeiro | mensalidade, vencimento, situação e segunda via | S | 5 | 11 |

---

## E14. Loja de Comida (restaurante parceiro)

| ID | História | Critérios de aceite | Pri | Pts | Sprint |
|---|---|---|---|---|---|
| CT-140 | Como PO, quero descobrir o modelo de negócio com o restaurante antes de especificar | reunião com o parceiro; definido quem cobra, quem entrega, se há comissão e se existe cardápio digital hoje | C | 3 | 9 |
| CT-141 | Como aluno, quero ver o cardápio e pedir pelo app | escopo a definir depois de CT-140 | W | ? | - |

---

## Riscos do backlog

| Risco | Impacto | Mitigação |
|---|---|---|
| Plano do EVO não liberar API, ou liberar com rate limit baixo | Trava o projeto inteiro | CT-010 é a primeira tarefa da Sprint 0. Sem essa confirmação, não se começa a Sprint 1 |
| Verificação do WhatsApp Business demorar | Atrasa o disparo | CT-020 na Sprint 0, em paralelo. Desenvolvimento segue com Evolution API e números de teste |
| Base com telefones errados ou desatualizados | Campanha entrega pouco | CT-013 mede cobertura antes do primeiro disparo. Se vier abaixo de 70%, a primeira campanha vira campanha de atualização cadastral |
| Primeira campanha gerar reclamação e opt-out em massa | Queima o canal e a confiança do dono | CT-036 obriga disparo de teste. Primeiro lote real limitado a 100 pessoas |
| Custo de mensagem maior que o esperado | Estoura o orçamento | Desenho de janela de serviço na seção 6 da arquitetura. Custo estimado exibido antes de confirmar a campanha (CT-033) |
| Bot soar artificial e derrubar a taxa de resposta | Mata o objetivo principal | CT-042 com filtro determinístico, e teste cego com 10 pessoas reais antes do disparo geral |
