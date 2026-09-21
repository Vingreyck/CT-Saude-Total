# CT Saúde Total — Visão de Produto

> Documento vivo. Origem: reunião de PO com o dono da academia em 18/09/2026.

## 1. O problema

A academia opera hoje sobre o EVO (ABC Evo / w12.com.br), que resolve cadastro, contrato, catraca e cobrança, mas não resolve **relacionamento** nem **inteligência sobre o cliente**. O dono não sabe, de forma estruturada e contínua:

- quem está prestes a cancelar;
- o que cada aluno reclama, elogia ou pede;
- por que quem sumiu, sumiu;
- qual o NPS real e como ele se move mês a mês.

Ele também não tem canal ativo de comunicação em massa, nem operação interna organizada (chamados, turnos, escala, comunicação entre funções).

## 2. A aposta central

> **A coleta de informação é o produto. O resto é embalagem.**

Essa foi a única exigência classificada como inegociável pelo dono. Chatbot, disparo, app e painel existem primariamente como **veículos de captura de dado**. Toda decisão de escopo é desempatada pela pergunta: *isso gera mais dado estruturado sobre o cliente?*

Consequência prática de arquitetura: **nenhuma conversa pode terminar apenas em texto livre**. Todo fluxo do bot precisa desaguar em registro estruturado e consultável (nota, categoria, tag, intenção, entidade), com o texto original preservado ao lado como evidência.

## 3. Por que o canal é o WhatsApp, e não o app

Decisão do PO: as pessoas abrem WhatsApp, não abrem app de academia. O app virá, mas como canal secundário de serviço (reservas, avisos, gamificação). O canal primário de coleta é e continuará sendo o WhatsApp, inclusive depois do app no ar.

## 4. Atores

| Ator | Descrição | Canal principal |
|---|---|---|
| Aluno ativo | Cliente com contrato vigente no EVO | WhatsApp → depois app |
| Ex-aluno / inativo | Cancelou ou está em atraso | WhatsApp (campanha de retorno) |
| Prospect | Lead que não fechou | WhatsApp |
| Atendente | Recepção | Web |
| Professor | Trabalha por turnos alternados | Web → depois app interno |
| Gerente | Operação da unidade | Web |
| ADM / dono | Vê tudo, incluindo todos os chats | Web (painel) |

## 5. Escopo fechado na reunião

1. Chatbot de WhatsApp humanizado, conectado ao EVO.
2. Disparo em massa para toda a base cadastrada (aniversário, novidades, avisos, e principalmente **feedback**).
3. Coleta de informação e pesquisa de satisfação via chatbot.
4. Agendamento com reserva da sala **Recovery**.
5. Agendamento da **quadra de areia** parceira (beach tennis, vôlei).
6. Controle financeiro completo automatizado.
7. Lembrete automático de ausência a partir do 3º dia sem passar na catraca.
8. Chamados internos / alarme operacional (equipamento quebrado, banheiro entupido, vazamento, limpeza).
9. Chat interno segmentado por função, com ADM enxergando todos os chats.
10. Controle de horário e escala de trabalho por turnos.
11. Gamificação e bonificação para atendentes e professores (indicações e contratos fechados).
12. BI no sistema.
13. App do cliente.
14. Loja de comida integrada ao restaurante ao lado — **em aberto**, sem escopo definido.

## 6. Fora de escopo por enquanto

- Substituir o EVO. O EVO segue como sistema de registro (cadastro, contrato, catraca, cobrança). Nosso sistema é a **camada de relacionamento e inteligência** por cima dele.
- Emissão fiscal e maquininha.
- Personal trainer / prescrição de treino.

## 7. Métricas de sucesso

| Métrica | Alvo do 1º ciclo |
|---|---|
| Cobertura de contato | ≥ 90% dos ativos com WhatsApp válido e verificado |
| Taxa de resposta à pesquisa | ≥ 35% dos disparados |
| Respostas convertidas em dado estruturado | 100% (por construção) |
| NPS medido | Baseline estabelecido no 1º mês |
| Tempo do dono até um insight | < 1 minuto no painel, sem pedir relatório para ninguém |
| Custo por resposta coletada | < R$ 2,00 (mensagem + LLM) |

## 8. Princípios de produto

1. **Dado estruturado sempre.** Texto livre é evidência, não resultado.
2. **Humano antes de bonito.** O bot precisa soar como gente do CT. Ver [05-persona-bot.md](05-persona-bot.md).
3. **O EVO é a fonte da verdade cadastral.** Nunca duplicamos cadastro, espelhamos.
4. **Opt-out é sagrado.** Um "para" encerra tudo, para sempre, em qualquer fluxo.
5. **Entregar fatia fina e vertical.** Cada sprint entrega algo que o dono consegue abrir e ver, não uma camada técnica invisível.
