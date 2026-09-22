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
| [08-evo-api.md](08-evo-api.md) | **Referência da EVO API.** Cota, filtros, campos reais e as armadilhas encontradas |

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

## Decisões tomadas em 22/09/2026

| Decisão | Resultado |
|---|---|
| Plano do EVO | **Fica no API Plus.** Não vale pagar o Pro. Ver abaixo |
| Frequência do sync | **A cada 2 horas**, incremental (só quem mudou) |
| Número do WhatsApp | **De teste** por enquanto. O real fica para o disparo à base inteira |

### Por que o plano Plus basta

Eu recomendei o upgrade para o Pro e **estava errado**. A recomendação vinha de duas suposições que a especificação da API desmentiu:

1. Achei que cada requisição trazia 50 alunos. O máximo é **10.000**: a base inteira de 3.167 cabe em **uma** requisição, não em 64.
2. Existe o filtro **`updateDate`**, que traz só quem mudou. O sync diário vira uma chamada com pouca coisa dentro.

Resultado: o consumo caiu de ~1.900 requisições por mês para **360**, dentro do limite de 1.000 do Plus. E com essa folga o sync passou de 1x por dia para **de 2 em 2 horas**.

### E o webhook do EVO

O webhook avisaria na hora que um aluno muda, em vez de esperar a próxima consulta. O único risco concreto de não ter é **alguém cancelar e ainda receber campanha**. Com o sync de 2 em 2 horas, essa janela caiu de 24 horas para 2.

Pagar R$ 39,90 por mês para reduzir de 2 horas para 2 segundos não se justifica numa academia de bairro. Além disso, `GET /api/v2/webhook` **responde no plano Plus**, então talvez nem seja uma trava de plano. Ver [08-evo-api.md](08-evo-api.md).

**Reavaliar se:** o dono quiser boas-vindas no momento exato da matrícula, a base crescer muito, ou aparecer reclamação real de ex-aluno recebendo mensagem.

## Decisão que ainda é do dono

**A pesquisa vai ser identificada ou anônima?** No WhatsApp o número identifica a pessoa de qualquer jeito. Ver [06](06-pesquisa-satisfacao.md), seção 1.3.
