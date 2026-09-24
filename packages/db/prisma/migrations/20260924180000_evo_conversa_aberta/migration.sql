-- Conexao real com o EVO e conversa de quem ainda nao e aluno.
--
-- Tudo aditivo, menos o DROP NOT NULL, que so afrouxa. Aplica em base com
-- dado sem travar nada e sem perder linha.

-- 1. Ultima passagem na catraca. Vem pronta do EVO em lastAccessDate, entao
--    da para saber quem sumiu sem depender da carga historica de check-in.
ALTER TABLE "membro" ADD COLUMN "ultimoAcessoEm" TIMESTAMP(3);
CREATE INDEX "membro_ultimoAcessoEm_idx" ON "membro"("ultimoAcessoEm");

-- 2. Quem escreve para o numero da academia nem sempre esta na base. Antes
--    disso, mensagem de numero desconhecido nao tinha onde ser gravada.
ALTER TABLE "conversa" ALTER COLUMN "membroId" DROP NOT NULL;
ALTER TABLE "conversa" ADD COLUMN "telefoneE164" TEXT;
ALTER TABLE "conversa" ADD COLUMN "nomeContato" TEXT;

-- Uma conversa por numero: e isso que faz a mensagem seguinte cair na mesma
-- thread em vez de abrir uma nova a cada webhook. Nulo nao conflita com nulo
-- no Postgres, entao as conversas antigas do laboratorio continuam validas.
CREATE UNIQUE INDEX "conversa_canal_telefoneE164_key" ON "conversa"("canal", "telefoneE164");

-- 3. Historico de sincronizacao, para o painel dizer quando foi a ultima vez.
CREATE TABLE "sincronizacao_evo" (
    "id" TEXT NOT NULL,
    "modo" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminadaEm" TIMESTAMP(3),
    "lidos" INTEGER NOT NULL DEFAULT 0,
    "criados" INTEGER NOT NULL DEFAULT 0,
    "atualizados" INTEGER NOT NULL DEFAULT 0,
    "semTelefone" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,

    CONSTRAINT "sincronizacao_evo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sincronizacao_evo_iniciadaEm_idx" ON "sincronizacao_evo"("iniciadaEm");

-- Uma sincronizacao por vez. E indice parcial, nao coluna, entao o Prisma nao
-- o modela no schema: ele existe so no banco, de proposito.
--
-- Sem isso, o cron do worker e o botao do painel poderiam ler a base do EVO
-- ao mesmo tempo e queimar cota a toa. Linha que fica aberta por mais de 30
-- minutos e fechada pelo proprio codigo antes da proxima tentativa.
CREATE UNIQUE INDEX "sincronizacao_evo_uma_por_vez"
    ON "sincronizacao_evo" ((1))
    WHERE "terminadaEm" IS NULL;
