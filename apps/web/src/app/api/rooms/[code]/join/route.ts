// POST /api/rooms/[code]/join — войти в существующую комнату.
// См. PROMPT.md §2.3.3.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureUser, requireUserId } from "@/lib/identity";
import { isValidRoomCode } from "@/lib/room-code";
import { loadRoomSnapshot, saveRoomSnapshot } from "@/lib/room-snapshot";
import { issueWsToken, wsConnectUrlFor } from "@/lib/ws-token";
import type { JoinRoomResponse } from "@/types";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const userId = await requireUserId();
    const { code: rawCode } = await params;
    const code = rawCode.toUpperCase();
    if (!isValidRoomCode(code)) {
      return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const displayName =
      typeof body.displayName === "string" ? body.displayName.trim() : "";
    if (displayName.length === 0) {
      return NextResponse.json({ error: "displayName required" }, { status: 400 });
    }
    const trimmed = displayName.slice(0, 50);

    const room = await prisma.room.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        hostId: true,
        roundTime: true,
        winScore: true,
        penaltySkip: true,
        categories: { select: { categoryId: true } },
        _count: { select: { participants: true } },
      },
    });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    if (room.status === "FINISHED") {
      return NextResponse.json({ error: "Room is finished" }, { status: 410 });
    }

    await ensureUser(userId, trimmed);

    const isHost = room.hostId === userId;

    // Идемпотентный Participant: upsert по (roomId, userId).
    // Берём joinOrder = текущий count, если запись новая.
    const existing = await prisma.participant.findUnique({
      where: { roomId_userId: { roomId: room.id, userId } },
      select: { id: true, joinOrder: true, leftAt: true, role: true, teamId: true },
    });

    // 409 только для новых игроков, если игра уже идёт. Существующие
    // (или сам хост) могут переподключаться в любой момент.
    if (!existing && !isHost && room.status === "IN_GAME") {
      return NextResponse.json(
        { error: "Game already started — late joins are not supported" },
        { status: 409 },
      );
    }

    let joinOrder: number;
    if (existing) {
      joinOrder = existing.joinOrder;
      if (existing.leftAt) {
        await prisma.participant.update({
          where: { id: existing.id },
          data: { leftAt: null, joinedAt: new Date() },
        });
      }
    } else {
      joinOrder = room._count.participants;
      await prisma.participant.create({
        data: {
          roomId: room.id,
          userId,
          role: "SPECTATOR",
          joinOrder,
        },
      });
    }

    // Обновляем snapshot в Redis: добавляем нового зрителя, если его там нет.
    const snapshot = await loadRoomSnapshot(code);
    if (snapshot) {
      const alreadyInTeam = snapshot.teams.some((t) =>
        t.players.some((p) => p.userId === userId),
      );
      const alreadySpectator = snapshot.spectators.some(
        (s) => s.userId === userId,
      );
      if (!alreadyInTeam && !alreadySpectator) {
        snapshot.spectators.push({
          userId,
          displayName: trimmed,
          online: false,
          order: joinOrder,
        });
        await saveRoomSnapshot(snapshot);
      }
    }

    const wsToken = issueWsToken({
      userId,
      roomCode: code,
      role: isHost ? "host" : "player",
    });

    const response: JoinRoomResponse = {
      room: {
        code: room.code,
        title: room.title,
        status: room.status,
        hostId: room.hostId,
        settings: {
          roundTime: room.roundTime,
          winScore: room.winScore,
          penaltySkip: room.penaltySkip,
          categoryIds: room.categories.map((c) => c.categoryId),
        },
        playersCount: room._count.participants + (existing ? 0 : 1),
      },
      user: { id: userId, displayName: trimmed },
      wsUrl: wsConnectUrlFor(request),
      wsToken,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "NO_AID_COOKIE") {
      return NextResponse.json({ error: "Identity cookie missing" }, { status: 400 });
    }
    console.error("[POST /api/rooms/[code]/join]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
