"use client";

// Какой игре принадлежит код комнаты.
//
// Раньше это решала дверь: с лендинга Алиаса код уходил во вход Алиаса, с
// лендинга Мафии — во вход Мафии. Но игра — свойство самого кода, а не того,
// откуда человек пришёл, и дверь ошибалась: мафийный код, набранный в форме
// Алиаса, доходил до серверного входа Алиаса и ронял живую партию.
//
// Теперь спрашиваем сервер. Ответ нужен и до входа (какой API звать), и до
// молчаливого возвращения в комнату (чьи креды восстанавливать).

/** Игра, которой принадлежит комната. */
export type RoomGame = "alias" | "mafia";

/**
 * «Комнаты нет» и «спросить не вышло» — разные ответы, и путать их нельзя:
 * во втором случае комната может быть жива, и говорить человеку, что кода не
 * существует, — значит отправить его перенабирать верный код.
 */
export type ResolveOutcome =
  | { game: RoomGame }
  | { game: null; reason: "not_found" | "unavailable" };

export const NOT_FOUND_TEXT = "Комнаты с таким кодом нет. Проверь код.";
export const UNAVAILABLE_TEXT = "Не получилось проверить код. Попробуй ещё раз.";

/** Текст для человека по неудачному исходу. */
export function resolveErrorText(reason: "not_found" | "unavailable"): string {
  return reason === "not_found" ? NOT_FOUND_TEXT : UNAVAILABLE_TEXT;
}

export async function resolveRoomGame(code: string): Promise<ResolveOutcome> {
  try {
    const res = await fetch(`/api/rooms/resolve?code=${encodeURIComponent(code)}`);
    if (res.status === 404) return { game: null, reason: "not_found" };
    // Остальные коды — это мы, а не человек: лимит запросов, упавшая база.
    if (!res.ok) return { game: null, reason: "unavailable" };
    const data = (await res.json()) as { platform?: string };
    return { game: data.platform === "MAFIA" ? "mafia" : "alias" };
  } catch {
    return { game: null, reason: "unavailable" };
  }
}
