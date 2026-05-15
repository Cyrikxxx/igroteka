"use client";

// Singleton Socket.io клиент для namespace /room. Используется хуком
// useRoom. Создаётся лениво по первому подключению, переоткрывается с
// другим code/token через `connectToRoom`.

import { io, type Socket } from "socket.io-client";

let current: Socket | null = null;
let currentKey: string | null = null;

export interface ConnectOpts {
  wsUrl: string;
  token: string;
  code: string;
}

export function connectToRoom(opts: ConnectOpts): Socket {
  const key = `${opts.wsUrl}|${opts.code}|${opts.token}`;
  if (current && currentKey === key) return current;
  if (current) {
    current.disconnect();
    current = null;
  }
  current = io(`${opts.wsUrl}/room`, {
    auth: { token: opts.token, code: opts.code },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });
  currentKey = key;
  return current;
}

export function disconnectRoom(): void {
  if (current) {
    current.disconnect();
    current = null;
    currentKey = null;
  }
}

export function currentSocket(): Socket | null {
  return current;
}
