"use client";

// Передача состояния между REST-ответом (создание/вход в комнату) и
// страницей лобби — через sessionStorage. Живёт пока вкладка открыта.

const KEY_PREFIX = "alias.room.";

export interface RoomCredentials {
  code: string;
  wsUrl: string;
  wsToken: string;
  userId: string;
  displayName: string;
}

const key = (code: string) => `${KEY_PREFIX}${code.toUpperCase()}`;

export function saveRoomCreds(creds: RoomCredentials): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key(creds.code), JSON.stringify(creds));
}

export function loadRoomCreds(code: string): RoomCredentials | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key(code));
    if (!raw) return null;
    return JSON.parse(raw) as RoomCredentials;
  } catch {
    return null;
  }
}

export function clearRoomCreds(code: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(key(code));
}

// Ник запоминаем глобально между разными комнатами.
const DISPLAY_NAME_KEY = "alias.displayName";

export function saveDisplayName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISPLAY_NAME_KEY, name);
}

export function loadDisplayName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(DISPLAY_NAME_KEY) ?? "";
}
