// POST /api/mafia/rooms/[code]/join — войти в комнату Мафии по коду.
// Создаёт Participant + выдаёт WS-токен (game=mafia). Список игроков в
// снапшоте пополняет уже WS-событие mafia:hello при подключении.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureUser, requireUserId } from "@/lib/identity";
import { isValidRoomCode } from "@/lib/room-code";
import { issueWsToken, wsConnectUrlFor } from "@/lib/ws-token";
import { loadMafiaSnapshot, saveMafiaSnapshot } from "@/lib/mafia-snapshot";
import { checkRateLimit } from "@/lib/rate-limit";
import { MAX_MAFIA_PLAYERS, type MafiaJoinRoomResponse } from "@alias/shared/mafia";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const limited = checkRateLimit(request, {
      name: "join-mafia",
      limit: 20,
      windowSec: 60,
    });
    if (limited) return limited;

    const userId = await requireUserId();
    const { code: rawCode } = await params;
    const code = rawCode.toUpperCase();
    if (!isValidRoomCode(code)) {
      return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
    }

    // Имя обязательно только для нового человека. Тот, кто уже в комнате,
    // возвращается без него: он узнаётся по куке `aid`, а имя у него уже есть.
    const body = await request.json().catch(() => ({}));
    const displayName =
      typeof body.displayName === "string" ? body.displayName.trim().slice(0, 50) : "";

    const room = await prisma.room.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        platform: true,
        hostId: true,
        _count: { select: { participants: true } },
      },
    });
    if (!room || room.platform !== "MAFIA") {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    if (room.status === "FINISHED") {
      return NextResponse.json({ error: "Room is finished" }, { status: 410 });
    }

    // Снимок — источник истины по составу: там и бан-лист, и текущая фаза.
    const snapshot = await loadMafiaSnapshot(code);

    // Живое состояние комнаты протухло, а строка осталась в LOBBY — код стал
    // зомби: сюда пускали с 200, а WS сразу отвечал «комнаты нет». Закрываем
    // её честно и здесь же: отдельный дворник ради этого не нужен.
    if (!snapshot) {
      await prisma.room
        .updateMany({ where: { code }, data: { status: "FINISHED", endedAt: new Date() } })
        .catch(() => {});
      // Партия из этой комнаты иначе навсегда осталась бы «в процессе».
      await prisma.game
        .updateMany({
          where: { room: { code }, status: "IN_PROGRESS" },
          data: { status: "FINISHED", finishedAt: new Date() },
        })
        .catch(() => {});
      return NextResponse.json({ error: "Room is finished" }, { status: 410 });
    }

    const entry = snapshot
      ? (snapshot.players.find((p) => p.userId === userId) ??
        snapshot.spectators.find((p) => p.userId === userId) ??
        null)
      : null;

    if (snapshot && !entry) {
      if (snapshot.banned?.some((b) => b.userId === userId)) {
        return NextResponse.json(
          { error: "Хост заблокировал вам вход в эту комнату" },
          { status: 403 },
        );
      }
      if (
        snapshot.phase === "LOBBY" &&
        snapshot.players.length >= MAX_MAFIA_PLAYERS
      ) {
        return NextResponse.json(
          { error: `В комнате уже ${MAX_MAFIA_PLAYERS} игроков` },
          { status: 409 },
        );
      }
    }

    if (displayName.length === 0 && !entry) {
      return NextResponse.json({ error: "displayName required" }, { status: 400 });
    }
    const trimmed = displayName || (entry?.displayName ?? "");

    // Имя, введённое заново, должно применяться: раньше оно молча терялось, и
    // в комнате оставалось то, под которым человек зашёл в первый раз. Меняем
    // только в лобби — переименование посреди партии всех запутает.
    if (snapshot && entry && displayName && displayName !== entry.displayName) {
      if (snapshot.phase === "LOBBY") {
        entry.displayName = displayName;
        await saveMafiaSnapshot(snapshot);
      }
    }

    await ensureUser(userId, trimmed);
    const isHost = room.hostId === userId;

    const existing = await prisma.participant.findUnique({
      where: { roomId_userId: { roomId: room.id, userId } },
      select: { id: true, joinOrder: true, leftAt: true },
    });

    // Партия уже идёт — новый игрок войдёт зрителем (snapshot решит это в WS).
    if (existing?.leftAt) {
      await prisma.participant.update({
        where: { id: existing.id },
        data: { leftAt: null, joinedAt: new Date() },
      });
    } else if (!existing) {
      await prisma.participant.create({
        data: {
          roomId: room.id,
          userId,
          role: "PLAYER",
          joinOrder: room._count.participants,
        },
      });
    }

    const wsToken = issueWsToken({
      userId,
      roomCode: code,
      role: isHost ? "host" : "player",
      game: "mafia",
    });

    const response: MafiaJoinRoomResponse = {
      room: {
        code: room.code,
        title: room.title,
        settings:
          snapshot?.settings ??
          ({} as MafiaJoinRoomResponse["room"]["settings"]),
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
    console.error("[POST /api/mafia/rooms/[code]/join]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
