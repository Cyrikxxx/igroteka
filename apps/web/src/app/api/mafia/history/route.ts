// GET /api/mafia/history — завершённые партии Мафии, в которых участвовал
// юзер: и те, что он хостил, и те, где просто играл. Для экрана истории.

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/identity";

export async function GET() {
  try {
    const userId = await requireUserId();
    const games = await prisma.mafiaGame.findMany({
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
        players: { select: { name: true, role: true, alive: true }, orderBy: { order: "asc" } },
      },
    });
    return NextResponse.json(games);
  } catch (e) {
    if ((e as Error).message === "NO_AID_COOKIE") {
      return NextResponse.json([], { status: 200 });
    }
    console.error("[GET /api/mafia/history]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
