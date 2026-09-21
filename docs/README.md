# Documentação — CT Saúde Total

Saída da reunião de PO com o dono da academia, em 18/09/2026.

| Documento | Para que serve |
|---|---|
| [00-visao-produto.md](00-visao-produto.md) | O problema, a aposta central, atores, escopo fechado e métricas de sucesso |
| [01-arquitetura.md](01-arquitetura.md) | Stack, estrutura do repo, modelo de dados, integração EVO, canal de WhatsApp e custo de disparo, LGPD |
| [02-backlog.md](02-backlog.md) | 93 histórias em 15 épicos, com critério de aceite, prioridade, pontos e sprint |
| [03-sprints.md](03-sprints.md) | **Alocação oficial das sprints.** Calendário, metas, demos e definição de pronto |
| [04-comparativo-ia.md](04-comparativo-ia.md) | Qual LLM conduz o bot: preço, prós, contras e simulação de custo por campanha |
| [05-persona-bot.md](05-persona-bot.md) | Como o bot fala, o que é proibido, e o filtro em código que garante isso |
| [06-pesquisa-satisfacao.md](06-pesquisa-satisfacao.md) | O formulário do dono convertido em conversa de WhatsApp, com o que gravar |
| [07-setup.md](07-setup.md) | Como rodar na máquina, como publicar no Railway, e o que já está pronto no código |

## Quadro kanban

O backlog inteiro vive também num quadro publicado, com filtro por sprint e por épico, anotação por cartão e estado compartilhado: **https://claude.ai/artifact/JAq28y3GWyiwArbHqUJCmS**

É privado. Para o dono da academia ou qualquer outra pessoa abrir, precisa compartilhar pelo menu Share da própria página.

Para levar para Jira, Trello ou outro: [backlog-jira.csv](backlog-jira.csv), ou o botão "Exportar CSV" dentro do quadro.

## Decisões tomadas em 19/09/2026

| Decisão | Resultado |
|---|---|
| Qual LLM conduz o bot | **Claude Sonnet 5** na conversa, **Haiku 4.5** na extração. Ver [04](04-comparativo-ia.md) |
| Formato da pesquisa | **Perguntas no WhatsApp**, uma por vez. Sem link de formulário. Ver [06](06-pesquisa-satisfacao.md), seção 1.2 |
| O formulário da RN Movement | É só referência de conteúdo, o dono gostou do formato. Todo texto sai com o nome **CT Saúde Total** |
| Canal de WhatsApp | Cloud API oficial da Meta. Ver [01](01-arquitetura.md), seção 6 |

## Único bloqueio em aberto

**O plano do EVO da academia libera API?** (CT-010). Como descobrir em 5 minutos está em [01-arquitetura.md](01-arquitetura.md), seção 7.1. Nada da Sprint 1 começa sem essa resposta.

## Decisão que ainda é do dono

**A pesquisa vai ser identificada ou anônima?** No WhatsApp o número identifica a pessoa de qualquer jeito. Ver [06](06-pesquisa-satisfacao.md), seção 1.3.
