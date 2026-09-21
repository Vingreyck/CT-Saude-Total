# Pesquisa de Satisfação — do formulário para o WhatsApp

Base: o formulário que o dono gostou. Referência para CT-050, CT-051, CT-052 e CT-056.

## 1. Três coisas para acertar antes de construir

### 1.1 O formulário é referência, não o texto final  ✅ resolvido

Confirmado em 19/09/2026: o dono gostou **do formato e das perguntas** do formulário da RN Movement, e mostrou como exemplo. Não é um formulário do CT.

Então o conteúdo é aproveitado, e **todo texto sai com o nome CT Saúde Total**. Nenhuma mensagem pode mencionar RN Movement. Isso vira item de checklist antes do primeiro disparo (CT-024 e CT-050).

### 1.2 Formulário no link ou perguntas soltas no WhatsApp?  ✅ decidido

**Decisão: perguntas no WhatsApp, uma por mensagem. Sem link de formulário.**

Comparando as duas formas:

| | Link de formulário no WhatsApp | Perguntas na conversa |
|---|---|---|
| Quem responde | Só quem clica, sai do WhatsApp, espera carregar e encara 18 campos. Taxa típica de 10% a 15% | Quem já está com a conversa aberta na mão. Taxa típica de 35% a 50% |
| Custo da mensagem | Paga o template e acabou. A pessoa não responde, então a janela de 24h nunca abre | Paga um template, a pessoa responde e **todo o resto da conversa é gratuito** |
| Profundidade do dado | O que ela digitou, e só | O bot reage e aprofunda. "Tava sujo" vira "qual banheiro, em que horário" |
| Quem desiste no meio | Perde tudo. Formulário só grava no envio final | Cada resposta já cai no banco na hora. Metade respondida ainda é dado útil |
| Sensação | Pesquisa institucional | Alguém da academia puxando papo |

O terceiro e o quarto pontos são os que decidem. **O valor do projeto não é a nota média, é o detalhe**, e formulário não tem como perguntar de volta. E a pessoa que responde 3 de 6 perguntas já entregou dado que o formulário teria jogado fora.

**Por isso as 18 perguntas viram 6.** Conversa de 18 perguntas ninguém termina. O desenho de núcleo mais rodízio da seção 3 resolve isso: cada aluno responde 6, e a base inteira cobre as 18.

**E as notas de 1 a 5, não fica chato digitar?** Fica, se forem 10 delas. Com 2 por pessoa, não. Se na prática a taxa de abandono aparecer justamente nas notas, o WhatsApp oficial permite mandar lista de opções clicáveis (limite de 10 itens por lista, o que cobre 1 a 5 tranquilo e deixa o 0 a 10 do NPS de fora). Fica como ajuste da Sprint 2, medindo antes.

**Único caso em que o link entra:** se o aluno pedir. "Prefiro responder depois com calma" existe, e aí o bot manda o link e fecha. É exceção, não o caminho principal.

### 1.3 A promessa de anonimato não sobrevive ao WhatsApp

O formulário diz "esta pesquisa é anônima". No WhatsApp, o número identifica a pessoa, e o valor que o dono quer está justamente em **saber quem disse o quê**, para poder ligar para o detrator antes que ele cancele.

São duas coisas incompatíveis. Escolha uma, e a escolha muda o texto e o schema:

| Opção | O que ganha | O que perde |
|---|---|---|
| **A. Identificada, e avisa** ("sua resposta vai pro dono, com seu nome") | Ação individual: retorno ao detrator, alerta de risco de churn, perfil enriquecido | Menos sinceridade nas críticas duras |
| **B. Anônima de verdade** (grava a resposta sem ligação com o membro) | Crítica mais honesta | Perde o principal valor do projeto. Não dá para ligar para ninguém |
| **C. Híbrida** (identificada por padrão, com "quer que isso fique sem seu nome?" nas perguntas abertas sensíveis) | Quase tudo dos dois | Um pouco mais de lógica no fluxo |

**Recomendo a C**, e o texto sendo honesto: "quem lê isso é o dono, e ele lê tudo". Ser direto costuma gerar mais crítica útil que uma promessa de anonimato que a pessoa não acredita mesmo, já que ela sabe que está falando do próprio WhatsApp.

Decisão pendente do dono. Está na lista da Sprint 0.

## 2. Duas perguntas que não devem ser perguntadas

O EVO já sabe. Perguntar o que você já tem gasta paciência do aluno, e paciência é o recurso mais escasso da conversa.

| Pergunta do formulário | De onde vem sem perguntar |
|---|---|
| "Há quanto tempo você treina?" | Data de início do contrato, via `GET /api/v1/members` |
| "Com que frequência você treina?" | Média de check-ins da catraca (CT-016). Mais confiável que a autodeclaração, que costuma ser otimista |

Bônus: comparar a frequência **real** da catraca com a **percebida** pelo aluno é um dado que o formulário jamais daria, e é ótimo indicador de risco de cancelamento. Quem acha que vai três vezes por semana mas vai uma, está saindo.

## 3. O desenho: núcleo + rodízio

### Núcleo, todo mundo responde (6 perguntas, ~2 minutos de verdade)

| # | Pergunta | Tipo | Campo |
|---|---|---|---|
| 1 | De 0 a 10, quanto você indicaria o CT pra um amigo? | escala 0-10 | `resposta_pesquisa.nps` |
| 2 | O que te fez dar essa nota? | texto aberto | `resposta_item` + `insight` |
| 3 | Nota rotativa 1 (ver abaixo) | nota 1-5 | `resposta_item` |
| 4 | Nota rotativa 2 | nota 1-5 | `resposta_item` |
| 5 | Se pudesse mudar uma coisa aqui, qual seria? | texto aberto | `resposta_item` + `insight` |
| 6 | Quer deixar um elogio pra alguém da equipe? | texto aberto, pode pular | `resposta_item` + `insight` (entidade: professor) |

A pergunta 6 é a única opcional no formulário original, e vale manter no núcleo por um motivo prático: ela **fecha a conversa em tom positivo** e alimenta a gamificação da equipe (CT-120). Elogio nominal a professor vira ponto.

### Rodízio dos 8 itens de nota

Em vez de pedir as 8 notas para todo mundo, cada aluno recebe **2 sorteadas**, com sorteio balanceado pela cobertura já existente no período.

Com 400 respostas e 8 itens, cada item recebe cerca de **100 avaliações por campanha**. Isso é amostra mais que suficiente para média confiável, e a conversa fica 4 vezes mais curta.

Itens no rodízio: atendimento da recepção, atenção dos professores, limpeza, organização dos equipamentos, climatização, horários de funcionamento, aulas coletivas, custo-benefício do plano.

### Aprofundamento, em campanhas seguintes

Vai em micro-pesquisas de 2 ou 3 perguntas, distribuídas ao longo dos meses:

- Você sente que recebe atenção suficiente dos professores? (sempre / na maioria das vezes / às vezes / raramente / nunca)
- Acha que o CT evoluiu nos últimos meses? (sim / mais ou menos / não)
- Tem algum equipamento que você queria que tivesse aqui?
- O que você mais gosta no CT?
- O que podemos melhorar?

Cada uma dessas é uma campanha leve, de uma pergunta só, que cabe numa conversa de 30 segundos e mantém o canal vivo entre as pesquisas grandes.

## 4. Como a conversa acontece

```
[template pago, abre a conversa]
  oi {nome}, aqui é a Rafa do CT Saúde Total
  o dono tá querendo ouvir o pessoal pra melhorar umas coisas
  posso te fazer 5 perguntinhas? leva 2 min

[aluno responde qualquer coisa → janela de 24h aberta, tudo daqui pra frente é gratis]

  de 0 a 10, quanto você indicaria o CT pra um amigo seu?

[8]

  boa, obrigada
  o que te fez dar 8 e não 10?

[a climatizacao naquele horario da tarde ta bem ruim, muito quente]
  -> insight: categoria=estrutura, subcategoria=climatizacao,
     sentimento=negativo, entidade={periodo: tarde}, urgencia=media

  entendi, o calor da tarde mesmo
  vou passar isso pro pessoal
  e a limpeza, de 1 a 5 como tá?

[4]

  e o atendimento da recepção, de 1 a 5?

[5]

  se você pudesse mudar uma coisa só aqui, qual seria?

[o ar condicionado kkkk]

  hahaha anotado, tá no topo da lista
  última: quer deixar um elogio pra alguém da equipe? se não quiser é só falar não

[o professor Diego é gente boa demais]
  -> insight: categoria=equipe, sentimento=positivo,
     entidade={professor: "Diego"} -> vira ponto pro Diego na gamificacao

  vou falar pra ele
  valeu demais {nome}, isso ajuda muito aqui
```

Note que a conversa **reage** antes de seguir. "Entendi, o calor da tarde mesmo" custa uma linha e é o que separa conversa de formulário falante.

## 5. Regras de robustez do fluxo

Isso é o que quebra na vida real:

| Situação | Comportamento |
|---|---|
| Responde "oito" em vez de "8" | Interpreta. Aceita número por extenso, com texto junto ("uns 8"), e emoji de número |
| Responde fora da escala ("11", "1000") | Reconhece com bom humor e registra o teto, sem dar bronca |
| Responde duas perguntas de uma vez | Aproveita as duas, não repete a que já foi respondida |
| Manda áudio | Transcreve e segue normal (CT-025) |
| Some no meio | Um único lembrete depois de 24h (CT-054). Nunca dois |
| Responde dias depois | Retoma de onde parou, sem recomeçar |
| Puxa outro assunto ("queria remarcar meu plano") | Atende ou encaminha, e **depois** pergunta se pode voltar à pesquisa |
| Vem irritado | Para de coletar, reconhece, oferece falar com a equipe, encerra |
| Nota crítica (item ≤ 2 ou NPS ≤ 6) | Termina a conversa normal, e dispara alerta no painel (CT-055) |
| Fala "para" | Encerra tudo e registra opt-out. Sempre, em qualquer ponto |

## 6. O que fica gravado

Toda resposta gera **duas camadas**:

1. **Resposta bruta** em `resposta_item` (`valor_num`, `valor_texto`, `valor_opcao`), que é a evidência, sempre preservada.
2. **Extração estruturada** em `insight`, que é o que o painel consulta:

```json
{
  "origem": "resposta_item",
  "categoria": "estrutura",
  "subcategoria": "climatizacao",
  "sentimento": "negativo",
  "urgencia": "media",
  "entidades": { "periodo": "tarde", "local": "sala de musculacao" },
  "tags": ["calor", "ar-condicionado", "horario-de-pico"]
}
```

**Taxonomia versionada.** Categoria e subcategoria vêm de uma lista fechada e versionada, não do que o modelo inventar na hora. Sem isso, em três meses você tem "limpeza", "Limpeza", "higiene" e "sujeira" como quatro categorias diferentes, e o ranking do painel vira lixo.

Taxonomia inicial: `estrutura`, `equipamentos`, `limpeza`, `equipe`, `aulas`, `horarios`, `preco`, `atendimento`, `resultado-do-treino`, `outro`.

## 7. Frequência de disparo

| Pesquisa | Quando | Público |
|---|---|---|
| Núcleo completo | Trimestral | Todos os ativos |
| Micro-pesquisa de 1 pergunta | Mensal, alternando o tema | Metade da base por vez |
| Pós-entrada | 30 dias depois da matrícula | Aluno novo |
| Saída | No cancelamento | Quem cancelou |
| Ausência | 3º dia sem catraca (CT-070) | Quem sumiu |

**Teto rígido: no máximo uma pesquisa por aluno a cada 30 dias**, contando todas as réguas juntas. Sem esse teto, as réguas se somam sem ninguém perceber, o aluno recebe três pesquisas no mesmo mês, e o canal queima. Essa trava vai no código, não no combinado verbal.
