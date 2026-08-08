"use client";

// Состояние комнаты Мафии на клиенте. Подключение к неймспейсу /mafia,
// персональный MafiaView (своя роль видна, чужие — нет), локальный таймер.

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { MafiaView, MafiaTickPayload } from "@alias/shared/mafia";
import { connectToRoom, disconnectRoom } from "@/lib/socket-client";

export type MafiaConnStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "closed";

interface UseMafiaRoomOptions {
  wsUrl: string;
  token: string;
  code: string;
  name: string;
}

export interface MafiaTimerState {
  msLeft: number;
  paused: boolean;
}

/** Коды ошибок сервера → человеческий текст. Иначе игрок видит «room_full». */
const ERROR_TEXT: Record<string, string> = {
  room_not_found: "Комната не найдена или уже закрыта",
  room_full: "В комнате уже максимум игроков",
  kicked: "Хост удалил вас из этой комнаты",
  forbidden: "Это может сделать только хост",
  paused: "Игра на паузе",
  already_checked: "Проверку можно сделать один раз за ночь",
  not_enough_players: "Нужно больше игроков",
  too_many_players: "Слишком много игроков",
};

export function mafiaErrorText(code: string): string {
  return ERROR_TEXT[code] ?? code;
}

export interface UseMafiaRoomResult {
  socket: Socket | null;
  view: MafiaView | null;
  timer: MafiaTimerState | null;
  status: MafiaConnStatus;
  error: string | null;
}

export function useMafiaRoom(
  opts: UseMafiaRoomOptions | null,
): UseMafiaRoomResult {
  const [view, setView] = useState<MafiaView | null>(null);
  const [timer, setTimer] = useState<MafiaTimerState | null>(null);
  const [status, setStatus] = useState<MafiaConnStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!opts) return;
    const sock = connectToRoom({
      wsUrl: opts.wsUrl,
      token: opts.token,
      code: opts.code,
      namespace: "/mafia",
      name: opts.name,
    });
    socketRef.current = sock;

    const applyTimer = (v: MafiaView | null) => {
      if (v?.timer) setTimer({ msLeft: v.timer.msLeft, paused: v.timer.paused });
      else setTimer(null);
    };

    const onConnect = () => {
      setStatus("connected");
      setError(null);
      sock.emit("mafia:hello", {}, (resp: unknown) => {
        if (
          resp &&
          typeof resp === "object" &&
          "error" in (resp as Record<string, unknown>)
        ) {
          setError(mafiaErrorText(String((resp as { error: string }).error)));
          return;
        }
        const v = resp as MafiaView;
        setView(v);
        applyTimer(v);
      });
    };
    const onState = (v: MafiaView) => {
      setView(v);
      applyTimer(v);
    };
    const onTick = (p: MafiaTickPayload) =>
      setTimer({ msLeft: p.msLeft, paused: p.paused });
    const onConnectError = (err: Error) => {
      setStatus("error");
      setError(err.message);
    };
    const onReconnectAttempt = () => setStatus("reconnecting");
    const onDisconnect = (reason: string) => {
      if (reason === "io server disconnect" || reason === "io client disconnect") {
        setStatus("closed");
      } else {
        setStatus("reconnecting");
      }
    };
    const onClosed = (payload: { reason: string }) => {
      setStatus("closed");
      setError(payload.reason === "kicked" ? "Тебя удалили из комнаты" : `Комната закрыта (${payload.reason})`);
    };

    sock.on("connect", onConnect);
    sock.on("mafia:state", onState);
    sock.on("mafia:tick", onTick);
    sock.on("connect_error", onConnectError);
    sock.on("disconnect", onDisconnect);
    sock.io.on("reconnect_attempt", onReconnectAttempt);
    sock.on("mafia:closed", onClosed);

    // Уже подключённый сокет (навигация без реконнекта) — синхронизируемся вручную.
    if (sock.connected) onConnect();

    return () => {
      sock.off("connect", onConnect);
      sock.off("mafia:state", onState);
      sock.off("mafia:tick", onTick);
      sock.off("connect_error", onConnectError);
      sock.off("disconnect", onDisconnect);
      sock.io.off("reconnect_attempt", onReconnectAttempt);
      sock.off("mafia:closed", onClosed);
    };
  }, [opts?.wsUrl, opts?.token, opts?.code, opts?.name, opts]);

  // Локальный обратный отсчёт между серверными тиками/снапшотами.
  useEffect(() => {
    if (!timer || timer.paused) return;
    const id = setInterval(() => {
      setTimer((prev) =>
        prev && !prev.paused
          ? { ...prev, msLeft: Math.max(0, prev.msLeft - 250) }
          : prev,
      );
    }, 250);
    return () => clearInterval(id);
  }, [timer?.paused, timer === null]);

  useEffect(() => {
    return () => {
      disconnectRoom();
      socketRef.current = null;
    };
  }, []);

  return { socket: socketRef.current, view, timer, status, error };
}
