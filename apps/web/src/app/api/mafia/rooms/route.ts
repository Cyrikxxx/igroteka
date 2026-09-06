// POST /api/mafia/rooms — создать комнату Мафии.
// Зеркало /api/rooms, но platform=MAFIA + снимок MafiaSnapshot в Redis.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureUser, requireUserId } from "@/lib/identity";
import { generateUniqueRoomCode } from "@/lib/room-code";
import { buildMafiaLobbySnapshot, saveMafiaSnapshot } from "@/lib/mafia-snapshot";
import { issueWsToken, wsConnectUrlFor } from "@/lib/ws-token";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  normalizeMafiaSettings,
  type MafiaCreateRoomResponse,
} from "@alias/shared/mafia";

export async function POST(request: NextRequest) {
  try {
    // Создание комнаты пишет в базу — без лимита её легко засыпать пустыми.
    const limited = checkRateLimit(request, {
      name: "create-mafia",
      limit: 10,
      windowSec: 60,
    });
    if (limited) return limited;

    const userId = await requireUserId();
    const body = await request.json().catch(() => ({}));
    const { hostName, title, settings } = body ?? {};

    if (typeof hostName !== "string" || hostName.trim().length === 0) {
      return NextResponse.json({ error: "hostName required" }, { status: 400 });
    }
    const trimmedHost = hostName.trim().slice(0, 50);
    const trimmedTitle =
      typeof title === "string" && title.trim().length > 0
        ? title.trim().slice(0, 80)
        : null;
    const parsedSettings = normalizeMafiaSettings(settings);

    await ensureUser(userId, trimmedHost);
    const code = await generateUniqueRoomCode();

    const room = await prisma.room.create({
      data: {
        code,
        platform: "MAFIA",
        hostId: userId,
        title: trimmedTitle,
        participants: { create: { userId, role: "PLAYER", joinOrder: 0 } },
      },
      select: { code: true, hostId: true, title: true },
    });

    const snapshot = buildMafiaLobbySnapshot({
      code: room.code,
      title: room.title,
      hostId: room.hostId,
      hostDisplayName: trimmedHost,
      settings: parsedSettings,
    });
    await saveMafiaSnapshot(snapshot);

    const wsToken = issueWsToken({
      userId,
      roomCode: room.code,
      role: "host",
      game: "mafia",
    });

    const response: MafiaCreateRoomResponse = {
      room: {
        code: room.code,
        title: room.title,
        hostId: room.hostId,
        settings: parsedSettings,
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
    console.error("[POST /api/mafia/rooms]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
