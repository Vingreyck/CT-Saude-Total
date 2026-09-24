-- Triagem deterministica (CT-045): marca a conversa que precisa de gente.
-- Aditiva e com default, entao aplica em base com dado sem travar nada.
ALTER TABLE "conversa" ADD COLUMN "precisaHumano" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "conversa" ADD COLUMN "motivoTriagem" TEXT;
