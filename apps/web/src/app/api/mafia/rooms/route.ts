// POST /api/mafia/rooms — создать комнату Мафии.
// Зеркало /api/rooms, но platform=MAFIA + снимок MafiaSnapshot в Redis.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureUser, requireUserId } from "@/lib/identity";
import { generateUniqueRoomCode } from "@/lib/room-code";
import { buildMafiaLobbySnapshot, saveMafiaSnapshot } from "@/lib/mafia-snapshot";
import { issueWsToken, wsConnectUrlFor } from "@/lib/ws-token";
import {
  DEFAULT_MAFIA_SETTINGS,
  type MafiaSettings,
  type MafiaCreateRoomResponse,
} from "@alias/shared/mafia";

/** Слить присланные настройки с дефолтами и проклампить. */
function parseSettings(input: unknown): MafiaSettings {
  const d = DEFAULT_MAFIA_SETTINGS;
  const s: MafiaSettings = {
    mafiaCount: d.mafiaCount,
    roles: { ...d.roles },
    timers: { ...d.timers },
    rules: { ...d.rules },
  };
  if (!input || typeof input !== "object") return s;
  const x = input as Record<string, unknown>;
  if (x.mafiaCount === "auto") s.mafiaCount = "auto";
  else if (typeof x.mafiaCount === "number")
    s.mafiaCount = Math.max(1, Math.min(8, Math.round(x.mafiaCount)));
  if (x.roles && typeof x.roles === "object") {
    const r = x.roles as Record<string, unknown>;
    for (const k of ["don", "sheriff", "doctor", "maniac"] as const)
      if (typeof r[k] === "boolean") s.roles[k] = r[k] as boolean;
  }
  if (x.timers && typeof x.timers === "object") {
    const t = x.timers as Record<string, unknown>;
    const clamp = (v: unknown, lo: number, hi: number, def: number) =>
      typeof v === "number" ? Math.max(lo, Math.min(hi, Math.round(v))) : def;
    s.timers.night = clamp(t.night, 15, 180, d.timers.night);
    s.timers.discussion = clamp(t.discussion, 30, 600, d.timers.discussion);
    s.timers.vote = clamp(t.vote, 15, 120, d.timers.vote);
    s.timers.lastWord = clamp(t.lastWord, 10, 90, d.timers.lastWord);
  }
  if (x.rules && typeof x.rules === "object") {
    const ru = x.rules as Record<string, unknown>;
    for (const k of [
      "firstDayNoVote",
      "revealRoles",
      "openVotes",
      "donHiddenFromSheriff",
      "spectatorsSeeRoles",
    ] as const)
      if (typeof ru[k] === "boolean") s.rules[k] = ru[k] as boolean;
  }
  return s;
}

export async function POST(request: NextRequest) {
  try {
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
    const parsedSettings = parseSettings(settings);

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
