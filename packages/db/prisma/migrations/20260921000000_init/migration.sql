-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StatusMembro" AS ENUM ('ATIVO', 'INATIVO', 'PROSPECT', 'CANCELADO');

-- CreateEnum
CREATE TYPE "CanalContato" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "StatusConsentimento" AS ENUM ('OPT_IN', 'OPT_OUT');

-- CreateEnum
CREATE TYPE "DirecaoMensagem" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "TipoMensagem" AS ENUM ('TEXTO', 'AUDIO', 'IMAGEM', 'DOCUMENTO', 'TEMPLATE', 'INTERATIVO');

-- CreateEnum
CREATE TYPE "StatusEntrega" AS ENUM ('PENDENTE', 'ENVIADO', 'ENTREGUE', 'LIDO', 'FALHOU');

-- CreateEnum
CREATE TYPE "TipoCampanha" AS ENUM ('FEEDBACK', 'ANIVERSARIO', 'NOVIDADE', 'AVISO', 'AUSENCIA', 'RETORNO', 'COBRANCA');

-- CreateEnum
CREATE TYPE "StatusCampanha" AS ENUM ('RASCUNHO', 'AGENDADA', 'TESTE', 'DISPARANDO', 'PAUSADA', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusAlvo" AS ENUM ('PENDENTE', 'ENVIADO', 'ENTREGUE', 'RESPONDIDO', 'FALHOU', 'PULADO');

-- CreateEnum
CREATE TYPE "TipoPergunta" AS ENUM ('NOTA', 'ESCALA_NPS', 'OPCAO', 'TEXTO');

-- CreateEnum
CREATE TYPE "StatusResposta" AS ENUM ('INICIADA', 'PARCIAL', 'CONCLUIDA', 'ABANDONADA');

-- CreateEnum
CREATE TYPE "Sentimento" AS ENUM ('POSITIVO', 'NEUTRO', 'NEGATIVO');

-- CreateEnum
CREATE TYPE "Urgencia" AS ENUM ('BAIXA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "OrigemInsight" AS ENUM ('MENSAGEM', 'RESPOSTA_ITEM');

-- CreateEnum
CREATE TYPE "FuncaoInterna" AS ENUM ('ADM', 'GERENTE', 'PROFESSOR', 'ATENDENTE');

-- CreateEnum
CREATE TYPE "IntencaoMensagem" AS ENUM ('FEEDBACK', 'DUVIDA', 'RECLAMACAO', 'AGENDAMENTO', 'COMERCIAL', 'OPT_OUT', 'OUTRO');

-- CreateTable
CREATE TABLE "unidade" (
    "id" TEXT NOT NULL,
    "idEvo" INTEGER,
    "nome" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_interno" (
    "id" TEXT NOT NULL,
    "idEvo" INTEGER,
    "unidadeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT,
    "funcao" "FuncaoInterna" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_interno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membro" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "idEvo" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "telefoneE164" TEXT,
    "telefoneValido" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "nascimento" TIMESTAMP(3),
    "status" "StatusMembro" NOT NULL DEFAULT 'ATIVO',
    "plano" TEXT,
    "inicioContrato" TIMESTAMP(3),
    "fimContrato" TIMESTAMP(3),
    "sincronizadoEm" TIMESTAMP(3),
    "payloadEvo" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objetivo" TEXT,
    "horarioPreferido" TEXT,
    "modalidadeFavorita" TEXT,
    "comoConheceu" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimento" (
    "id" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "canal" "CanalContato" NOT NULL DEFAULT 'WHATSAPP',
    "status" "StatusConsentimento" NOT NULL,
    "finalidade" TEXT NOT NULL,
    "textoAceito" TEXT,
    "origem" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversa" (
    "id" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "canal" "CanalContato" NOT NULL DEFAULT 'WHATSAPP',
    "janelaServicoExpiraEm" TIMESTAMP(3),
    "assumidaPorId" TEXT,
    "assumidaEm" TIMESTAMP(3),
    "ultimaMensagemEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagem" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "direcao" "DirecaoMensagem" NOT NULL,
    "tipo" "TipoMensagem" NOT NULL DEFAULT 'TEXTO',
    "texto" TEXT,
    "transcricao" TEXT,
    "midiaUrl" TEXT,
    "templateNome" TEXT,
    "providerMessageId" TEXT,
    "statusEntrega" "StatusEntrega" NOT NULL DEFAULT 'PENDENTE',
    "intencao" "IntencaoMensagem",
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_entrega" (
    "id" TEXT NOT NULL,
    "mensagemId" TEXT NOT NULL,
    "evento" "StatusEntrega" NOT NULL,
    "payload" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanha" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoCampanha" NOT NULL,
    "status" "StatusCampanha" NOT NULL DEFAULT 'RASCUNHO',
    "templateNome" TEXT NOT NULL,
    "templateVars" JSONB,
    "segmento" JSONB NOT NULL,
    "pesquisaId" TEXT,
    "agendadaPara" TIMESTAMP(3),
    "iniciadaEm" TIMESTAMP(3),
    "concluidaEm" TIMESTAMP(3),
    "custoEstimado" DECIMAL(10,2),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campanha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanha_alvo" (
    "id" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "status" "StatusAlvo" NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "enviadoEm" TIMESTAMP(3),
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campanha_alvo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesquisa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "ativa" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pesquisa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pergunta" (
    "id" TEXT NOT NULL,
    "pesquisaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "tipo" "TipoPergunta" NOT NULL,
    "enunciado" TEXT NOT NULL,
    "obrigatoria" BOOLEAN NOT NULL DEFAULT true,
    "rotativa" BOOLEAN NOT NULL DEFAULT false,
    "opcoes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minimo" INTEGER,
    "maximo" INTEGER,
    "categoria" TEXT,

    CONSTRAINT "pergunta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resposta_pesquisa" (
    "id" TEXT NOT NULL,
    "pesquisaId" TEXT NOT NULL,
    "membroId" TEXT,
    "status" "StatusResposta" NOT NULL DEFAULT 'INICIADA',
    "nps" INTEGER,
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidaEm" TIMESTAMP(3),
    "lembreteEm" TIMESTAMP(3),

    CONSTRAINT "resposta_pesquisa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resposta_item" (
    "id" TEXT NOT NULL,
    "respostaPesquisaId" TEXT NOT NULL,
    "perguntaId" TEXT NOT NULL,
    "valorNum" INTEGER,
    "valorTexto" TEXT,
    "valorOpcao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resposta_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insight" (
    "id" TEXT NOT NULL,
    "origem" "OrigemInsight" NOT NULL,
    "mensagemId" TEXT,
    "respostaItemId" TEXT,
    "categoria" TEXT NOT NULL,
    "subcategoria" TEXT,
    "sentimento" "Sentimento" NOT NULL,
    "urgencia" "Urgencia" NOT NULL DEFAULT 'BAIXA',
    "entidades" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "taxonomiaVersao" INTEGER NOT NULL DEFAULT 1,
    "modeloUsado" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin" (
    "id" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'catraca_evo',
    "idEvo" TEXT,

    CONSTRAINT "checkin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerta_ausencia" (
    "id" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "diasSemIr" INTEGER NOT NULL,
    "disparadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT,
    "retornouEm" TIMESTAMP(3),

    CONSTRAINT "alerta_ausencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unidade_idEvo_key" ON "unidade"("idEvo");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_interno_idEvo_key" ON "usuario_interno"("idEvo");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_interno_email_key" ON "usuario_interno"("email");

-- CreateIndex
CREATE INDEX "usuario_interno_unidadeId_funcao_idx" ON "usuario_interno"("unidadeId", "funcao");

-- CreateIndex
CREATE UNIQUE INDEX "membro_idEvo_key" ON "membro"("idEvo");

-- CreateIndex
CREATE INDEX "membro_status_idx" ON "membro"("status");

-- CreateIndex
CREATE INDEX "membro_telefoneE164_idx" ON "membro"("telefoneE164");

-- CreateIndex
CREATE INDEX "membro_unidadeId_status_idx" ON "membro"("unidadeId", "status");

-- CreateIndex
CREATE INDEX "consentimento_status_idx" ON "consentimento"("status");

-- CreateIndex
CREATE UNIQUE INDEX "consentimento_membroId_canal_finalidade_key" ON "consentimento"("membroId", "canal", "finalidade");

-- CreateIndex
CREATE INDEX "conversa_membroId_idx" ON "conversa"("membroId");

-- CreateIndex
CREATE INDEX "conversa_janelaServicoExpiraEm_idx" ON "conversa"("janelaServicoExpiraEm");

-- CreateIndex
CREATE UNIQUE INDEX "mensagem_providerMessageId_key" ON "mensagem"("providerMessageId");

-- CreateIndex
CREATE INDEX "mensagem_conversaId_criadoEm_idx" ON "mensagem"("conversaId", "criadoEm");

-- CreateIndex
CREATE INDEX "evento_entrega_mensagemId_idx" ON "evento_entrega"("mensagemId");

-- CreateIndex
CREATE INDEX "campanha_status_agendadaPara_idx" ON "campanha"("status", "agendadaPara");

-- CreateIndex
CREATE UNIQUE INDEX "campanha_alvo_chaveIdempotencia_key" ON "campanha_alvo"("chaveIdempotencia");

-- CreateIndex
CREATE INDEX "campanha_alvo_campanhaId_status_idx" ON "campanha_alvo"("campanhaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campanha_alvo_campanhaId_membroId_key" ON "campanha_alvo"("campanhaId", "membroId");

-- CreateIndex
CREATE UNIQUE INDEX "pesquisa_nome_versao_key" ON "pesquisa"("nome", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "pergunta_pesquisaId_ordem_key" ON "pergunta"("pesquisaId", "ordem");

-- CreateIndex
CREATE INDEX "resposta_pesquisa_pesquisaId_status_idx" ON "resposta_pesquisa"("pesquisaId", "status");

-- CreateIndex
CREATE INDEX "resposta_pesquisa_membroId_idx" ON "resposta_pesquisa"("membroId");

-- CreateIndex
CREATE UNIQUE INDEX "resposta_item_respostaPesquisaId_perguntaId_key" ON "resposta_item"("respostaPesquisaId", "perguntaId");

-- CreateIndex
CREATE INDEX "insight_categoria_criadoEm_idx" ON "insight"("categoria", "criadoEm");

-- CreateIndex
CREATE INDEX "insight_sentimento_idx" ON "insight"("sentimento");

-- CreateIndex
CREATE INDEX "insight_urgencia_idx" ON "insight"("urgencia");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_idEvo_key" ON "checkin"("idEvo");

-- CreateIndex
CREATE INDEX "checkin_membroId_dataHora_idx" ON "checkin"("membroId", "dataHora");

-- CreateIndex
CREATE INDEX "checkin_dataHora_idx" ON "checkin"("dataHora");

-- CreateIndex
CREATE INDEX "alerta_ausencia_membroId_disparadoEm_idx" ON "alerta_ausencia"("membroId", "disparadoEm");

-- AddForeignKey
ALTER TABLE "usuario_interno" ADD CONSTRAINT "usuario_interno_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membro" ADD CONSTRAINT "membro_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimento" ADD CONSTRAINT "consentimento_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversa" ADD CONSTRAINT "conversa_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_entrega" ADD CONSTRAINT "evento_entrega_mensagemId_fkey" FOREIGN KEY ("mensagemId") REFERENCES "mensagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanha" ADD CONSTRAINT "campanha_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanha" ADD CONSTRAINT "campanha_pesquisaId_fkey" FOREIGN KEY ("pesquisaId") REFERENCES "pesquisa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanha_alvo" ADD CONSTRAINT "campanha_alvo_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "campanha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanha_alvo" ADD CONSTRAINT "campanha_alvo_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pergunta" ADD CONSTRAINT "pergunta_pesquisaId_fkey" FOREIGN KEY ("pesquisaId") REFERENCES "pesquisa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta_pesquisa" ADD CONSTRAINT "resposta_pesquisa_pesquisaId_fkey" FOREIGN KEY ("pesquisaId") REFERENCES "pesquisa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta_pesquisa" ADD CONSTRAINT "resposta_pesquisa_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta_item" ADD CONSTRAINT "resposta_item_respostaPesquisaId_fkey" FOREIGN KEY ("respostaPesquisaId") REFERENCES "resposta_pesquisa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta_item" ADD CONSTRAINT "resposta_item_perguntaId_fkey" FOREIGN KEY ("perguntaId") REFERENCES "pergunta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insight" ADD CONSTRAINT "insight_mensagemId_fkey" FOREIGN KEY ("mensagemId") REFERENCES "mensagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insight" ADD CONSTRAINT "insight_respostaItemId_fkey" FOREIGN KEY ("respostaItemId") REFERENCES "resposta_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin" ADD CONSTRAINT "checkin_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta_ausencia" ADD CONSTRAINT "alerta_ausencia_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

