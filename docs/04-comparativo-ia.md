# Qual IA vai conduzir o bot — comparativo

> Preços de tabela consultados em **setembro de 2026**, em USD por milhão de tokens. Conversão usada: **US$ 1 = R$ 5,40**. Confirme os valores no site do provedor antes de fechar contrato, porque essa lista muda rápido.
>
> **DECIDIDO em 19/09/2026:** delegado para mim. Escolha: **Claude Sonnet 5 conduzindo a conversa, Claude Haiku 4.5 fazendo a extração estruturada.** Custo estimado de ~R$ 290 por campanha de 400 respostas. Justificativa na seção 5. O resto do documento fica como registro da comparação e como base para revisar a escolha depois da primeira campanha.

## 1. Como o custo realmente se comporta aqui

Antes da tabela, o que move a conta neste projeto:

**Uma pesquisa completa custa cerca de 50 mil tokens de entrada e 2 mil de saída.** São ~18 turnos de conversa, e a cada turno o histórico inteiro volta para o modelo. Entrada domina a conta, saída é ruído. Logo: **o preço de input é o que importa**, e prompt caching (que desconta a parte repetida do histórico) pode derrubar essa conta em 60% a 90% dependendo do provedor.

**A mensagem do WhatsApp custa mais que a IA na maioria dos cenários.** Abrir conversa com template de marketing sai a ~R$ 0,34 por pessoa. Conduzir a conversa inteira com um modelo intermediário sai a ~R$ 0,30. Ou seja: economizar R$ 0,20 por conversa trocando de modelo muda pouco o total, mas pode custar caro em qualidade de texto, que é justamente o que determina se a pessoa responde ou não.

Conclusão prática: **não otimize o modelo pelo centavo. Otimize pela taxa de resposta**, porque resposta é o dado que o dono comprou.

## 2. A tabela

| Provedor / modelo | Input $/1M | Output $/1M | Custo por pesquisa completa | 400 pesquisas |
|---|---|---|---|---|
| **Claude Opus 5** | 5,00 | 25,00 | ~R$ 1,62 | ~R$ 650 |
| **Claude Sonnet 5** | 2,00 | 10,00 | ~R$ 0,65 | ~R$ 260 |
| **Claude Haiku 4.5** | 1,00 | 5,00 | ~R$ 0,32 | ~R$ 130 |
| **GPT-5** | 1,25 | 10,00 | ~R$ 0,45 | ~R$ 180 |
| **GPT-5.6-terra** | 2,00 | 12,00 | ~R$ 0,67 | ~R$ 270 |
| **GPT-5.6-luna** | 0,20 | 1,20 | ~R$ 0,07 | ~R$ 28 |
| **Gemini 3.8 Flash** | 0,75 | 3,75 | ~R$ 0,24 | ~R$ 96 |
| **Gemini 3.1 Pro** | 2,00 | 12,00 | ~R$ 0,67 | ~R$ 270 |
| **Gemini 2.5 Flash-Lite** | 0,10 | 0,40 | ~R$ 0,03 | ~R$ 12 |
| **DeepSeek V4-Flash** | 0,15 a 0,30 | 0,60 a 1,20 | ~R$ 0,05 a 0,09 | ~R$ 20 a 36 |

> Gemini 3.8 Flash está em preço promocional de lançamento. Sobe para US$ 1,50 / 7,50 em 1º de janeiro de 2027, o que dobra a linha dele. DeepSeek cobra diferente em horário de pico e fora de pico, e separa preço por cache hit e cache miss.

## 3. Prós e contras, para este projeto

### Claude (Anthropic)

**A favor**
- Melhor da lista em **seguir instrução de persona e de estilo**. Para um bot que precisa não ter vício de emoji, não usar travessão e soar como gente da recepção, isso é exatamente a habilidade que decide.
- Texto em português brasileiro natural, com menos cara de tradução.
- Prompt caching maduro, o que derruba muito a conta de input em conversa longa.
- Extração estruturada confiável com schema validado, que é o coração do CT-053.

**Contra**
- Não é o mais barato. Opus 5 só se justifica em tarefa de análise, não em conversa de pesquisa.
- Sem camada gratuita para teste.

**Se escolher:** Sonnet 5 conduz a conversa, Haiku 4.5 faz a extração em lote. Conta de ~R$ 290 por campanha de 400 respostas.

### OpenAI (GPT-5)

**A favor**
- Ecossistema maior, mais exemplo pronto, mais gente para perguntar.
- GPT-5.6-luna é absurdamente barato para o que entrega. Ótimo candidato para a extração estruturada e para classificação de intenção em volume.
- Voz e tempo real, se um dia o bot atender áudio ao vivo.

**Contra**
- Tom padrão mais "assistente prestativo". Dá para corrigir com prompt, mas exige mais trabalho para tirar a cara de IA do que Claude exige.
- A família tem muitos modelos com preços bem diferentes, o que facilita gastar sem perceber.

**Se escolher:** GPT-5 na conversa, GPT-5.6-luna na extração.

### Google Gemini

**A favor**
- **Melhor custo-benefício da lista** entre os modelos de qualidade decente, ainda mais no preço promocional do 3.8 Flash.
- Camada gratuita generosa para desenvolver e testar sem gastar nada, o que encaixa perfeitamente na Sprint 0 e 1.
- Contexto muito grande, útil quando a conversa for longa ou o histórico do aluno crescer.

**Contra**
- Qualidade de conversa em PT-BR é mais irregular que Claude e GPT. Precisa de teste cego antes de confiar.
- Troca de modelo e de preço com frequência alta, e o preço do 3.8 Flash dobra em janeiro de 2027.

**Se escolher:** 3.8 Flash na conversa, 2.5 Flash-Lite na extração. É a opção de menor custo com qualidade aceitável.

### DeepSeek

**A favor**
- O mais barato da lista com folga.
- Modelo aberto, dá para hospedar por conta própria se um dia quiser.

**Contra**
- **Ponto crítico de LGPD:** dado de aluno brasileiro trafega para infraestrutura na China. Isso é transferência internacional de dado pessoal, exige base legal específica e precisa estar na política de privacidade. Num produto cujo valor é a base de dados do dono, é um risco jurídico desproporcional à economia de R$ 100 por campanha.
- Preço varia por horário de pico, o que atrapalha previsão de custo.
- Latência maior a partir do Brasil, e latência alta em conversa de WhatsApp é percebida como robô.

**Se escolher:** use só para tarefa interna sem dado pessoal identificável, nunca na conversa com o aluno.

### Modelo aberto hospedado por você (Llama, Qwen, via Groq, Together ou self-host)

**A favor:** custo previsível, controle total do dado, sem dependência de fornecedor.
**Contra:** mais uma infra para manter, e qualidade de PT-BR conversacional abaixo dos fechados. Para um time de uma pessoa começando um produto, é distração.
**Recomendação:** deixe para depois, se o volume justificar.

## 4. A arquitetura que eu recomendo, independente do provedor

**Dois modelos, papéis diferentes:**

| Papel | Volume | Precisa de | Modelo |
|---|---|---|---|
| Conduzir a conversa | Alto em tokens | Naturalidade, seguir persona, não parecer IA | O melhor que couber no orçamento |
| Extrair estrutura do texto | Alto em chamadas, baixo em tokens | Obedecer schema JSON | O mais barato que acerte o schema |
| Resumir e analisar em lote | Baixo, roda de madrugada | Raciocínio | Pode ser o caro, roda pouco |

Isso está previsto no CT-040: o código fala com uma interface `ProvedorIA`, então trocar de fornecedor é mudar variável de ambiente, não reescrever o bot. **Você não fica preso à escolha desta semana.**

## 5. Minha recomendação, em uma linha

**Claude Sonnet 5 na conversa, Haiku 4.5 na extração**, porque o único fator que realmente decide o sucesso deste projeto é a taxa de resposta à pesquisa, e a taxa de resposta depende do bot não parecer um bot, que é exatamente onde Claude tem vantagem sobre os outros dessa lista. Custo estimado de ~R$ 290 por campanha de 400 respostas, contra ~R$ 340 só do disparo do WhatsApp. É a menor peça da conta.

**Se o orçamento for a trava:** Gemini 3.8 Flash na conversa e 2.5 Flash-Lite na extração, ~R$ 110 por campanha. Nesse caso, faça o teste cego do Sprint 2 com rigor, porque a diferença de naturalidade aparece justamente nas respostas mais longas.

**O que eu não faria:** DeepSeek na conversa com aluno, por causa da transferência internacional de dado pessoal. E Opus 5 na conversa, porque é gastar cinco vezes mais numa tarefa que não precisa desse nível de raciocínio.

## 6. Como decidir com dado em vez de opinião

Antes de fechar, na Sprint 2, rode isto:

1. Pegue **as 10 respostas mais longas** do formulário Google atual.
2. Faça os dois ou três modelos candidatos conduzirem a mesma conversa de pesquisa com esses conteúdos.
3. Mostre as conversas para o **dono e para duas atendentes**, sem dizer qual é qual.
4. Pergunte só uma coisa: **"qual dessas parece o pessoal do CT falando?"**

Custo do teste: menos de R$ 5. É a forma mais barata de transformar essa decisão em medição.

---

**Fontes:**
- [Pricing | OpenAI API](https://developers.openai.com/api/docs/pricing) e [OpenAI API Pricing 2026 — Morph](https://www.morphllm.com/openai-api-pricing)
- [Gemini Developer API pricing | Google AI for Developers](https://ai.google.dev/gemini-api/docs/pricing)
- [DeepSeek API pricing](https://deepseek.ai/pricing)
- [WhatsApp Business Platform Pricing](https://whatsappbusiness.com/products/platform-pricing/) e [WhatsApp Business API Pricing Brazil 2026](https://www.messagecentral.com/blog/whatsapp-business-api-pricing-brazil)
- Preços do Claude conforme tabela oficial da API Anthropic (Opus 5 US$ 5/25, Sonnet 5 US$ 2/10, Haiku 4.5 US$ 1/5)
