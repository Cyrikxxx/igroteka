// GET /api/rooms/[code] — снимок комнаты (для SSR-страницы /room/[code]).
// DELETE /api/rooms/[code] — закрыть комнату (только хост).
// См. PROMPT.md §2.3.3.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { readUserId } from "@/lib/identity";
import { isValidRoomCode } from "@/lib/room-code";
import {
  buildLobbySnapshot,
  deleteRoomSnapshot,
  loadRoomSnapshot,
  saveRoomSnapshot,
} from "@/lib/room-snapshot";
import type { RoomSnapshot } from "@/types";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const { code: rawCode } = await params;
    const code = rawCode.toUpperCase();
    if (!isValidRoomCode(code)) {
      return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
    }

    let snapshot = await loadRoomSnapshot(code);
    if (snapshot) return NextResponse.json(snapshot);

    // Redis-снимок мог утечь по TTL. Восстанавливаем минимум из Postgres
    // (host + settings + статус). Команды и игроки в Redis не восстанавливаются —
    // WS-сервер при подключении хоста положит снимок заново.
    const room = await prisma.room.findUnique({
      where: { code },
      select: {
        code: true,
        title: true,
        status: true,
        hostId: true,
        roundTime: true,
        winScore: true,
        penaltySkip: true,
        categories: { select: { categoryId: true } },
        host: { select: { displayName: true } },
      },
    });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const rebuilt: RoomSnapshot = buildLobbySnapshot({
      code: room.code,
      title: room.title,
      hostId: room.hostId,
      hostDisplayName: room.host.displayName,
      settings: {
        roundTime: room.roundTime,
        winScore: room.winScore,
        penaltySkip: room.penaltySkip,
        categoryIds: room.categories.map((c) => c.categoryId),
      },
    });
    rebuilt.status = room.status;
    // FINISHED-комнаты не кэшируем — экономим место в Redis. Активные
    // (LOBBY/IN_GAME) кладём, чтобы WS-сервер мог их подхватить.
    if (room.status !== "FINISHED") {
      await saveRoomSnapshot(rebuilt);
    }
    snapshot = rebuilt;

    return NextResponse.json(snapshot);
  } catch (e) {
    console.error("[GET /api/rooms/[code]]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const userId = await readUserId();
    if (!userId) {
      return NextResponse.json({ error: "Identity cookie missing" }, { status: 400 });
    }
    const { code: rawCode } = await params;
    const code = rawCode.toUpperCase();
    if (!isValidRoomCode(code)) {
      return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
    }

    const room = await prisma.room.findUnique({
      where: { code },
      select: { id: true, hostId: true },
    });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    if (room.hostId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.room.update({
      where: { id: room.id },
      data: { status: "FINISHED", endedAt: new Date() },
    });
    await deleteRoomSnapshot(code);

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error("[DELETE /api/rooms/[code]]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
