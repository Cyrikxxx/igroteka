"use client";

// Возвращение в комнату без экрана входа.
//
// Креды лежат в sessionStorage и умирают вместе со вкладкой, а человек в
// комнате — нет: он остаётся в снапшоте, потому что узнаётся по httpOnly-куке
// `aid`. Поэтому раньше при повторном заходе по ссылке спрашивали имя, а
// введённое всё равно игнорировали — в комнате оставалось старое.
//
// Тут мы просто просим сервер выдать креды заново. Имя не передаём: сервер
// сам возьмёт то, под которым человек уже сидит в комнате. Незнакомому
// (и выгнанному) он откажет — тогда показываем обычный экран входа.

import { saveRoomCreds, type RoomCredentials } from "@/lib/room-session";

type Game = "alias" | "mafia";

interface JoinLikeResponse {
  room: { code: string };
  user: { id: string; displayName: string };
  wsUrl: string;
  wsToken: string;
}

export async function resumeRoom(
  code: string,
  game: Game,
): Promise<RoomCredentials | null> {
  const url =
    game === "mafia"
      ? `/api/mafia/rooms/${code}/join`
      : `/api/rooms/${code}/join`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume: true }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as JoinLikeResponse;
    const creds: RoomCredentials = {
      code: data.room.code,
      wsUrl: data.wsUrl,
      wsToken: data.wsToken,
      userId: data.user.id,
      displayName: data.user.displayName,
      ...(game === "mafia" ? { game: "mafia" as const } : {}),
    };
    saveRoomCreds(creds);
    return creds;
  } catch {
    return null;
  }
}
