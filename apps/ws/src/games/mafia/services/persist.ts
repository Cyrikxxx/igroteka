// Сохранение итога завершённой партии Мафии в Postgres (для истории).
// Live-состояние живёт в Redis; сюда пишем только финал.

import prisma from "../../../prisma";
import type { MafiaSnapshot, MafiaWinner } from "@alias/shared/mafia";

const WINNER_DB: Record<MafiaWinner, "CITY" | "MAFIA" | "MANIAC"> = {
  city: "CITY",
  mafia: "MAFIA",
  maniac: "MANIAC",
};

export async function persistFinishedGame(snap: MafiaSnapshot): Promise<void> {
  if (!snap.winner) return;
  const room = await prisma.room.findUnique({
    where: { code: snap.code },
    select: { id: true },
  });

  await prisma.mafiaGame.create({
    data: {
      roomId: room?.id ?? null,
      hostId: snap.hostId,
      status: "FINISHED",
      winner: WINNER_DB[snap.winner],
      settings: JSON.parse(JSON.stringify(snap.settings)),
      events: JSON.parse(JSON.stringify(snap.events ?? [])),
      dayCount: snap.day,
      startedAt: new Date(snap.createdAt),
      endedAt: new Date(),
      players: {
        create: snap.players.map((p, i) => ({
          userId: p.userId,
          name: p.displayName,
          role: p.role ?? "civilian",
          alive: p.alive,
          eliminatedBy: p.eliminatedBy ?? null,
          deathDay: p.deathDay ?? null,
          order: i,
        })),
      },
    },
  });

  // Помечаем комнату завершённой.
  if (room?.id) {
    await prisma.room
      .update({ where: { id: room.id }, data: { status: "FINISHED", endedAt: new Date() } })
      .catch(() => {});
  }
}

/**
 * Вернуть комнату в набор после «сыграть ещё». Без этого запись в Postgres
 * осталась бы FINISHED, и REST-вход отвечал бы новым игрокам «партия уже
 * закончилась» — хотя в комнате идёт сбор на следующую.
 */
export async function reopenRoom(code: string): Promise<void> {
  await prisma.room
    .updateMany({
      where: { code },
      data: { status: "LOBBY", endedAt: null, startedAt: null },
    })
    .catch(() => {});
}
