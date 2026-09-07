-- DropIndex
DROP INDEX "MafiaGame_roomId_key";

-- CreateTable
CREATE TABLE "HiddenGame" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT,
    "mafiaGameId" TEXT,
    "hiddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiddenGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HiddenGame_userId_idx" ON "HiddenGame"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HiddenGame_userId_gameId_key" ON "HiddenGame"("userId", "gameId");

-- CreateIndex
CREATE UNIQUE INDEX "HiddenGame_userId_mafiaGameId_key" ON "HiddenGame"("userId", "mafiaGameId");

-- CreateIndex
CREATE INDEX "MafiaGame_roomId_idx" ON "MafiaGame"("roomId");

-- AddForeignKey
ALTER TABLE "HiddenGame" ADD CONSTRAINT "HiddenGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenGame" ADD CONSTRAINT "HiddenGame_mafiaGameId_fkey" FOREIGN KEY ("mafiaGameId") REFERENCES "MafiaGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
