// GET /api/mafia/history — партии Мафии, в которых участвовал юзер:
// и завершённые (из Postgres), и ещё идущие (снимки комнат в Redis),
// чтобы к брошенной партии можно было вернуться со страницы истории.

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/identity";
import { loadMafiaSnapshot } from "@/lib/mafia-snapshot";
import type { MafiaPhase } from "@alias/shared/mafia";

export interface MafiaHistoryGame {
  id: string;
  /** Есть только у идущих партий — по нему возвращаемся в комнату. */
  code?: string;
  status: "live" | "done";
  winner: "CITY" | "MAFIA" | "MANIAC" | null;
  /** Всего игроков в партии. */
  players: number;
  /** Сколько ещё в игре — только для идущих. */
  alive?: number;
  /** Человеческое название текущей фазы — только для идущих. */
  phase?: string;
  dayCount: number;
  endedAt: string | null;
  createdAt: string;
}

/** Подпись фазы для карточки идущей партии. */
function phaseLabel(phase: MafiaPhase, day: number): string {
  switch (phase) {
    case "LOBBY":
      return "Сбор игроков";
    case "ROLE_REVEAL":
      return "Раздача ролей";
    case "NIGHT":
      return `Ночь ${day}`;
    case "MORNING":
      return `Утро ${day}`;
    case "DISCUSSION":
      return `День ${day}`;
    case "VOTE":
      return "Голосование";
    case "VOTE_RESULT":
      return "Итог голосования";
    case "LAST_WORD":
      return "Последнее слово";
    default:
      return "Партия идёт";
  }
}

export async function GET() {
  try {
    const userId = await requireUserId();

    const [finished, liveRooms] = await Promise.all([
      prisma.mafiaGame.findMany({
        where: {
          status: "FINISHED",
          // Хостов меньшинство: показывать только свои комнаты значило бы
          // прятать историю от большинства игроков.
          OR: [{ hostId: userId }, { players: { some: { userId } } }],
        },
        orderBy: { endedAt: "desc" },
        take: 30,
        select: {
          id: true,
          winner: true,
          dayCount: true,
          endedAt: true,
          createdAt: true,
          _count: { select: { players: true } },
        },
      }),
      prisma.room.findMany({
        where: {
          platform: "MAFIA",
          status: { in: ["LOBBY", "IN_GAME"] },
          participants: { some: { userId, leftAt: null } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { code: true, createdAt: true },
      }),
    ]);

    // Живое состояние знает только Redis: в Postgres у идущей партии
    // ещё нет ни ролей, ни счёта.
    const live: MafiaHistoryGame[] = [];
    for (const room of liveRooms) {
      const snap = await loadMafiaSnapshot(room.code);
      if (!snap || snap.phase === "FINISHED") continue;
      live.push({
        id: room.code,
        code: room.code,
        status: "live",
        winner: null,
        players: snap.players.length,
        alive: snap.players.filter((p) => p.alive).length,
        phase: phaseLabel(snap.phase, snap.day),
        dayCount: snap.day,
        endedAt: null,
        createdAt: room.createdAt.toISOString(),
      });
    }

    const done: MafiaHistoryGame[] = finished.map((g) => ({
      id: g.id,
      status: "done",
      winner: g.winner,
      players: g._count.players,
      dayCount: g.dayCount,
      endedAt: g.endedAt ? g.endedAt.toISOString() : null,
      createdAt: g.createdAt.toISOString(),
    }));

    // Идущие — наверх: к ним можно вернуться прямо сейчас.
    return NextResponse.json([...live, ...done]);
  } catch (e) {
    if ((e as Error).message === "NO_AID_COOKIE") {
      return NextResponse.json([], { status: 200 });
    }
    console.error("[GET /api/mafia/history]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
