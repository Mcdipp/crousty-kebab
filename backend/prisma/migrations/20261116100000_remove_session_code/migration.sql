-- Suppression du système de code à 4 chiffres : les sessions sont désormais identifiées par leur UUID.
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_code_format_check";

-- DropIndex
DROP INDEX IF EXISTS "Session_code_expiresAt_idx";

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "code";

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
