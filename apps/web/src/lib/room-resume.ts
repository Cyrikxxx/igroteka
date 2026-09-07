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

export interface ResumeOutcome {
  /** Пустые — вернуться не вышло. */
  creds: RoomCredentials | null;
  /**
   * Комнаты больше нет (или тебя в неё не пустят). Отправлять человека на
   * экран входа в этом случае бессмысленно: он введёт имя и получит тот же
   * отказ. Вместо этого показываем, что случилось, и уводим на главную игры.
   */
  gone: boolean;
  /** Что сказать человеку, когда gone. */
  notice?: string;
}

/** Почему вернуться не вышло — по коду ответа сервера. */
function noticeFor(status: number, serverText?: string): string | null {
  if (status === 404) return "Комнаты больше нет — код освободился.";
  if (status === 410) return "Эта комната уже закрыта.";
  if (status === 403) return serverText || "Хост закрыл тебе вход в эту комнату.";
  return null;
}

export async function resumeRoom(code: string, game: Game): Promise<ResumeOutcome> {
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
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const notice = noticeFor(res.status, body.error);
      return notice
        ? { creds: null, gone: true, notice }
        : { creds: null, gone: false };
    }
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
    return { creds, gone: false };
  } catch {
    // Сеть отвалилась — это не «комнаты нет», человеку есть смысл попробовать
    // войти обычным путём.
    return { creds: null, gone: false };
  }
}
