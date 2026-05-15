// POST /api/rooms — создать онлайн-комнату. См. PROMPT.md §2.3.3.
//
// Поведение:
//   1. Гарантирует cookie `aid` (это делает proxy.ts).
//   2. Upsert'ит User с присланным hostName.
//   3. Генерирует уникальный 6-символьный код.
//   4. Создаёт Room в Postgres + RoomCategory[].
//   5. Кладёт стартовый LOBBY-снимок в Redis (TTL 24ч).
//   6. Возвращает { room, user, wsUrl, wsToken } — клиент сразу
//      коннектится к WS-серверу с этим токеном.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureUser, requireUserId } from "@/lib/identity";
import { generateUniqueRoomCode } from "@/lib/room-code";
import { buildLobbySnapshot, saveRoomSnapshot } from "@/lib/room-snapshot";
import { issueWsToken, wsConnectUrlFor } from "@/lib/ws-token";
import {
  ROUND_TIME_DEFAULT,
  WIN_SCORE_DEFAULT,
  PENALTY_SKIP_DEFAULT,
} from "@/constants/game";
import type { CreateRoomResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await request.json().catch(() => ({}));
    const { hostName, title, isPublic, settings } = body ?? {};

    if (typeof hostName !== "string" || hostName.trim().length === 0) {
      return NextResponse.json({ error: "hostName required" }, { status: 400 });
    }
    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "settings required" }, { status: 400 });
    }

    const roundTime = Number(settings.roundTime) || ROUND_TIME_DEFAULT;
    const winScore = Number.isFinite(settings.winScore)
      ? Number(settings.winScore)
      : WIN_SCORE_DEFAULT;
    const penaltySkip = Boolean(settings.penaltySkip ?? PENALTY_SKIP_DEFAULT);
    const categoryIds: number[] = Array.isArray(settings.categoryIds)
      ? settings.categoryIds.map((x: unknown) => Number(x)).filter(Number.isInteger)
      : [];

    if (roundTime < 10 || roundTime > 300) {
      return NextResponse.json({ error: "roundTime out of range" }, { status: 400 });
    }
    if (winScore < 0 || winScore > 1000) {
      return NextResponse.json({ error: "winScore out of range" }, { status: 400 });
    }
    if (categoryIds.length === 0) {
      return NextResponse.json(
        { error: "at least 1 category required" },
        { status: 400 },
      );
    }

    const validCategories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });
    if (validCategories.length === 0) {
      return NextResponse.json({ error: "no valid categories" }, { status: 400 });
    }

    const trimmedHost = hostName.trim().slice(0, 50);
    const trimmedTitle =
      typeof title === "string" && title.trim().length > 0
        ? title.trim().slice(0, 80)
        : null;

    await ensureUser(userId, trimmedHost);

    const code = await generateUniqueRoomCode();

    const room = await prisma.room.create({
      data: {
        code,
        hostId: userId,
        title: trimmedTitle,
        isPublic: Boolean(isPublic),
        roundTime,
        winScore,
        penaltySkip,
        categories: {
          create: validCategories.map((c) => ({ categoryId: c.id })),
        },
        // Хост сам — Participant в собственной комнате. SPECTATOR по дефолту;
        // переходит в команду через WS-событие team:join в лобби.
        participants: {
          create: {
            userId,
            role: "SPECTATOR",
            joinOrder: 0,
          },
        },
      },
      select: {
        code: true,
        hostId: true,
        title: true,
        roundTime: true,
        winScore: true,
        penaltySkip: true,
      },
    });

    const snapshot = buildLobbySnapshot({
      code: room.code,
      title: room.title,
      hostId: room.hostId,
      hostDisplayName: trimmedHost,
      settings: {
        roundTime: room.roundTime,
        winScore: room.winScore,
        penaltySkip: room.penaltySkip,
        categoryIds: validCategories.map((c) => c.id),
      },
    });
    await saveRoomSnapshot(snapshot);

    const wsToken = issueWsToken({
      userId,
      roomCode: room.code,
      role: "host",
    });

    const response: CreateRoomResponse = {
      room: {
        code: room.code,
        title: room.title,
        hostId: room.hostId,
        settings: snapshot.settings,
      },
      user: { id: userId, displayName: trimmedHost },
      wsUrl: wsConnectUrlFor(request),
      wsToken,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "NO_AID_COOKIE") {
      return NextResponse.json({ error: "Identity cookie missing" }, { status: 400 });
    }
    console.error("[POST /api/rooms]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
