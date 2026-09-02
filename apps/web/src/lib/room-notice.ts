"use client";

// Одноразовое сообщение, которое переживает переход на другую страницу.
//
// Нужно, когда человека выкидывает из комнаты: сама комната закрывается, а
// объяснить, что произошло, надо уже на главном экране игры. Держим в
// sessionStorage и стираем при первом же чтении — второй раз показывать
// «тебя выгнали» не за чем.

const KEY = "alias.roomNotice";

export interface RoomNotice {
  text: string;
  /** danger — выгнали или закрыли комнату; info — всё остальное. */
  tone?: "danger" | "info";
}

export function setRoomNotice(notice: RoomNotice): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(notice));
  } catch {
    // Приватный режим или переполненное хранилище — уведомление не критично.
  }
}

/** Читает и сразу стирает: сообщение показывается ровно один раз. */
export function takeRoomNotice(): RoomNotice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as RoomNotice;
    return typeof parsed?.text === "string" ? parsed : null;
  } catch {
    return null;
  }
}
