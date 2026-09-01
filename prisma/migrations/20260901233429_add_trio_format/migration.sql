-- CreateEnum
CREATE TYPE "GameFormat" AS ENUM ('TEAMS', 'TRIO');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "format" "GameFormat" NOT NULL DEFAULT 'TEAMS',
ADD COLUMN     "trioTurn" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "partnerTeamId" INTEGER;
