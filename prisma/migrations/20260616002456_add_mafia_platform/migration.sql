-- CreateEnum
CREATE TYPE "GamePlatform" AS ENUM ('ALIAS', 'MAFIA');

-- CreateEnum
CREATE TYPE "MafiaGameStatus" AS ENUM ('IN_PROGRESS', 'FINISHED');

-- CreateEnum
CREATE TYPE "MafiaWinnerDb" AS ENUM ('CITY', 'MAFIA', 'MANIAC');

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "platform" "GamePlatform" NOT NULL DEFAULT 'ALIAS';

-- CreateTable
CREATE TABLE "MafiaGame" (
    "id" TEXT NOT NULL,
    "roomId" TEXT,
    "hostId" TEXT NOT NULL,
    "status" "MafiaGameStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "winner" "MafiaWinnerDb",
    "settings" JSONB NOT NULL,
    "dayCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "MafiaGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MafiaPlayerRecord" (
    "id" SERIAL NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "alive" BOOLEAN NOT NULL DEFAULT true,
    "eliminatedBy" TEXT,
    "deathDay" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MafiaPlayerRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MafiaGame_roomId_key" ON "MafiaGame"("roomId");

-- CreateIndex
CREATE INDEX "MafiaGame_hostId_idx" ON "MafiaGame"("hostId");

-- CreateIndex
CREATE INDEX "MafiaGame_status_idx" ON "MafiaGame"("status");

-- CreateIndex
CREATE INDEX "MafiaPlayerRecord_gameId_idx" ON "MafiaPlayerRecord"("gameId");

-- AddForeignKey
ALTER TABLE "MafiaGame" ADD CONSTRAINT "MafiaGame_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MafiaPlayerRecord" ADD CONSTRAINT "MafiaPlayerRecord_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "MafiaGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
