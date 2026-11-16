-- Les sorties Tacos / Kebab servent uniquement à dire « j'y vais » : plus de choix individuel tacos / kebab.
ALTER TABLE "Participation" DROP COLUMN "choice";

-- DropEnum
DROP TYPE "ParticipationChoice";
