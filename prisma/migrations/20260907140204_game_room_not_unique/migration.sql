-- DropIndex
DROP INDEX "Game_roomId_key";

-- CreateIndex
CREATE INDEX "Game_roomId_idx" ON "Game"("roomId");
