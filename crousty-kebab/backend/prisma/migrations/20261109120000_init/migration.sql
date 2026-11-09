-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('CROUSTY', 'TACOS_KEBAB');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "FoodChoice" AS ENUM ('TACOS', 'KEBAB', 'BOTH');

-- CreateEnum
CREATE TYPE "ParticipationChoice" AS ENUM ('TACOS', 'KEBAB');

-- CreateEnum
CREATE TYPE "CroustyProduct" AS ENUM ('NATURE', 'PIQUANT', 'SUCRE', 'SUCRE_PIQUANT');

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "code" CHAR(4) NOT NULL,
    "type" "SessionType" NOT NULL,
    "foodChoice" "FoodChoice",
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "description" VARCHAR(300),
    "status" "SessionStatus" NOT NULL DEFAULT 'OPEN',
    "creatorName" VARCHAR(30) NOT NULL,
    "creatorTokenHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "nameKey" VARCHAR(30) NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "isCreator" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "targetName" VARCHAR(30) NOT NULL,
    "productType" "CroustyProduct" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participation" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "choice" "ParticipationChoice" NOT NULL,
    "notes" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_code_expiresAt_idx" ON "Session"("code", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_status_idx" ON "Session"("status");

-- CreateIndex
CREATE INDEX "Participant_tokenHash_idx" ON "Participant"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_sessionId_nameKey_key" ON "Participant"("sessionId", "nameKey");

-- CreateIndex
CREATE INDEX "Order_sessionId_idx" ON "Order"("sessionId");

-- CreateIndex
CREATE INDEX "Order_participantId_idx" ON "Order"("participantId");

-- CreateIndex
CREATE INDEX "Participation_sessionId_idx" ON "Participation"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Participation_sessionId_participantId_key" ON "Participation"("sessionId", "participantId");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Contraintes métier supplémentaires
ALTER TABLE "Session" ADD CONSTRAINT "Session_code_format_check" CHECK ("code" ~ '^[0-9]{4}$');
ALTER TABLE "Order" ADD CONSTRAINT "Order_quantity_check" CHECK ("quantity" BETWEEN 1 AND 20);
ALTER TABLE "Session" ADD CONSTRAINT "Session_closed_consistency_check" CHECK (("status" = 'CLOSED') = ("closedAt" IS NOT NULL));
