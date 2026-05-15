// GET /api/games/[id]?includeRounds=true — снимок локальной игры.
// DELETE /api/games/[id] — удалить.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/identity";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const includeRounds = request.nextUrl.searchParams.get("includeRounds") === "true";

    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        teams: {
          include: { players: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" },
        },
        gameCategories: { include: { category: true } },
        room: { select: { id: true } },
        ...(includeRounds
          ? {
              rounds: {
                include: { words: { include: { word: true }, orderBy: { order: "asc" } } },
                orderBy: { startedAt: "asc" },
              },
            }
          : {}),
      },
    });
    if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Доступ: владелец (LOCAL) или участник комнаты (ONLINE).
    let allowed = game.ownerKey === userId;
    if (!allowed && game.mode === "ONLINE" && game.room?.id) {
      const part = await prisma.participant.findUnique({
        where: { roomId_userId: { roomId: game.room.id, userId } },
        select: { id: true },
      });
      allowed = Boolean(part);
    }
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json(game);
  } catch (e) {
    if ((e as Error).message === "NO_AID_COOKIE") {
      return NextResponse.json({ error: "Identity cookie missing" }, { status: 400 });
    }
    console.error("[GET /api/games/[id]]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const game = await prisma.game.findUnique({ where: { id }, select: { ownerKey: true } });
    if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (game.ownerKey !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await prisma.game.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if ((e as Error).message === "NO_AID_COOKIE") {
      return NextResponse.json({ error: "Identity cookie missing" }, { status: 400 });
    }
    console.error("[DELETE /api/games/[id]]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
