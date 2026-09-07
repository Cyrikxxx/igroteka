// GET    /api/mafia/games/[id] — итоги завершённой партии Мафии.
// DELETE /api/mafia/games/[id] — убрать её из своей истории.
//
// Живое состояние партии живёт в Redis и умирает вместе с комнатой, а сюда
// persistFinishedGame кладёт финал целиком: победитель, роли, судьбу каждого и
// хронику ночей. Из этого и строится экран итогов.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/identity";
import type {
  MafiaEvent,
  MafiaRole,
  MafiaDeathCause,
  MafiaSettings,
} from "@alias/shared/mafia";

type Ctx = { params: Promise<{ id: string }> };

export interface MafiaResultPlayer {
  name: string;
  role: MafiaRole;
  alive: boolean;
  eliminatedBy: MafiaDeathCause | null;
  deathDay: number | null;
  /** Это ты — чтобы подсветить свою строку в составе. */
  you: boolean;
}

export interface MafiaResultGame {
  id: string;
  winner: "CITY" | "MAFIA" | "MANIAC" | null;
  dayCount: number;
  createdAt: string;
  endedAt: string | null;
  players: MafiaResultPlayer[];
  events: MafiaEvent[];
  /** Правила партии — из них собирается «сыграть так же». */
  settings: MafiaSettings;
}

/** Партию видит тот, кто в ней играл, и хост. */
async function loadForUser(id: string, userId: string) {
  const game = await prisma.mafiaGame.findUnique({
    where: { id },
    select: {
      id: true,
      hostId: true,
      winner: true,
      dayCount: true,
      events: true,
      settings: true,
      createdAt: true,
      endedAt: true,
      players: {
        orderBy: { order: "asc" },
        select: {
          userId: true,
          name: true,
          role: true,
          alive: true,
          eliminatedBy: true,
          deathDay: true,
        },
      },
    },
  });
  if (!game) return { game: null, allowed: false } as const;
  const allowed =
    game.hostId === userId || game.players.some((p) => p.userId === userId);
  return { game, allowed } as const;
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { game, allowed } = await loadForUser(id, userId);
    if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const response: MafiaResultGame = {
      id: game.id,
      winner: game.winner,
      dayCount: game.dayCount,
      createdAt: game.createdAt.toISOString(),
      endedAt: game.endedAt ? game.endedAt.toISOString() : null,
      players: game.players.map((p) => ({
        name: p.name,
        role: p.role as MafiaRole,
        alive: p.alive,
        eliminatedBy: (p.eliminatedBy as MafiaDeathCause | null) ?? null,
        deathDay: p.deathDay,
        you: p.userId === userId,
      })),
      // Хроника лежит в Json — в ней уже те самые MafiaEvent, что писал сервер.
      events: (game.events ?? []) as unknown as MafiaEvent[],
      settings: game.settings as unknown as MafiaSettings,
    };
    return NextResponse.json(response);
  } catch (e) {
    if ((e as Error).message === "NO_AID_COOKIE") {
      return NextResponse.json({ error: "Identity cookie missing" }, { status: 400 });
    }
    console.error("[GET /api/mafia/games/[id]]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Партию Мафии видят все, кто в ней играл, поэтому удалять её у всех нельзя:
 * каждый убирает карточку только из своей истории.
 */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { game, allowed } = await loadForUser(id, userId);
    if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // upsert, а не create: повторное нажатие не должно падать.
    await prisma.hiddenGame.upsert({
      where: { userId_mafiaGameId: { userId, mafiaGameId: id } },
      create: { userId, mafiaGameId: id },
      update: {},
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if ((e as Error).message === "NO_AID_COOKIE") {
      return NextResponse.json({ error: "Identity cookie missing" }, { status: 400 });
    }
    console.error("[DELETE /api/mafia/games/[id]]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
