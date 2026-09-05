"use client";

// Состояние онлайн-комнаты на клиенте. Подключение к WS, snapshot,
// серверный таймер, приватное слово для explainer'а.

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type {
  RoomSnapshot,
  RoundCommittedPayload,
  RoundPhasePayload,
  RoundReviewPayload,
  RoundWordPayload,
} from "@alias/shared/domain";
import { connectToRoom, disconnectRoom } from "@/lib/socket-client";

export type ConnStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "closed";

interface UseRoomOptions {
  wsUrl: string;
  token: string;
  code: string;
}

export interface RoundTickState {
  msLeft: number;
  paused: boolean;
}

export interface UseRoomResult {
  socket: Socket | null;
  snapshot: RoomSnapshot | null;
  status: ConnStatus;
  error: string | null;
  /**
   * Текст «почему комнаты больше нет» — заполняется только по событию
   * room:closed. Обычный обрыв связи его не ставит: по нему выкидывать
   * человека из комнаты нельзя, соединение ещё может вернуться.
   */
  closedReason: string | null;
  // Игровой цикл
  tick: RoundTickState | null;
  currentWord: RoundWordPayload | null;
  wordCount: { got: number; skip: number } | null;
  review: RoundReviewPayload | null;
  lastCommitted: RoundCommittedPayload | null;
}

export function useRoom(opts: UseRoomOptions | null): UseRoomResult {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [tick, setTick] = useState<RoundTickState | null>(null);
  const [currentWord, setCurrentWord] = useState<RoundWordPayload | null>(null);
  const [wordCount, setWordCount] = useState<{ got: number; skip: number } | null>(null);
  const [review, setReview] = useState<RoundReviewPayload | null>(null);
  const [lastCommitted, setLastCommitted] = useState<RoundCommittedPayload | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!opts) return;
    const sock = connectToRoom(opts);
    socketRef.current = sock;

    const onConnect = () => {
      setStatus("connected");
      setError(null);
      sock.emit("room:hello", {}, (resp: unknown) => {
        if (
          resp &&
          typeof resp === "object" &&
          "error" in (resp as Record<string, unknown>)
        ) {
          setError(String((resp as { error: string }).error));
          return;
        }
        const snap = resp as RoomSnapshot;
        setSnapshot(snap);
        // При входе в комнату с активным раундом — синхронизируем таймер из snapshot
        if (snap.timer) setTick({ msLeft: snap.timer.msLeft, paused: snap.timer.paused });
      });
    };
    const onState = (s: RoomSnapshot) => {
      setSnapshot(s);
      // При смене фазы чистим review/word, если ушли из соответствующих стейтов
      if (s.phase !== "ROUND_REVIEW") setReview(null);
      if (s.phase !== "ROUND_ACTIVE") {
        // оставляем currentWord на короткий момент перехода
        if (s.phase === "BETWEEN_ROUNDS" || s.phase === "PRE_ROUND") {
          setCurrentWord(null);
        }
      }
      if (!s.timer) setTick(null);
    };
    const onPhase = (p: RoundPhasePayload) => {
      if (p.phase === "ROUND_ACTIVE") {
        setWordCount({ got: 0, skip: 0 });
        if (p.durationMs) setTick({ msLeft: p.durationMs, paused: false });
      }
      if (p.phase === "ROUND_REVIEW") setTick((prev) => prev ? { ...prev, paused: true } : null);
    };
    // Тик приходит только когда раунд реально идёт: на паузе сервер их не
    // шлёт. Значит любой тик — сам по себе признак «пауза снята». Раньше
    // здесь тянулось прежнее значение, и после реконнекта на паузе флаг
    // оставался поднятым навсегда: кнопки «угадал/пропустить» так и стояли
    // заблокированными, а предупреждение не пропадало.
    const onTick = (p: { msLeft: number }) =>
      setTick({ msLeft: p.msLeft, paused: false });
    const onWord = (p: RoundWordPayload) => setCurrentWord(p);
    const onWordCount = (p: { got: number; skip: number; msLeft: number }) => {
      setWordCount({ got: p.got, skip: p.skip });
      setTick({ msLeft: p.msLeft, paused: false });
    };
    const onReview = (p: RoundReviewPayload) => setReview(p);
    const onCommitted = (p: RoundCommittedPayload) => {
      setLastCommitted(p);
      setReview(null);
      setCurrentWord(null);
    };

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
    // Причина приходит кодом — переводим её в текст, который не стыдно
    // показать: раньше на экран уезжало «Комната закрыта (kicked)».
    const CLOSED_REASON: Record<string, string> = {
      kicked: "Хост удалил тебя из комнаты.",
      closed_by_host: "Хост закрыл комнату.",
    };
    const onClosed = (payload: { reason: string }) => {
      const text = CLOSED_REASON[payload.reason] ?? "Комната закрыта.";
      setStatus("closed");
      setError(text);
      setClosedReason(text);
    };

    sock.on("connect", onConnect);
    sock.on("room:state", onState);
    sock.on("round:phase", onPhase);
    sock.on("round:tick", onTick);
    sock.on("round:word", onWord);
    sock.on("round:word_count", onWordCount);
    sock.on("round:review", onReview);
    sock.on("round:committed", onCommitted);
    sock.on("connect_error", onConnectError);
    sock.on("disconnect", onDisconnect);
    sock.io.on("reconnect_attempt", onReconnectAttempt);
    sock.on("room:closed", onClosed);

    // Сокет мог быть уже подключён к моменту монтирования (навигация
    // лобби→play без реконнекта) — тогда событие 'connect' не сработает.
    // Синхронизируемся вручную: room:hello вернёт snapshot и (для explainer'а)
    // повторно пришлёт текущее слово. Иначе при мгновенном старте раунда
    // слово могло бы потеряться в момент перехода.
    if (sock.connected) onConnect();

    return () => {
      sock.off("connect", onConnect);
      sock.off("room:state", onState);
      sock.off("round:phase", onPhase);
      sock.off("round:tick", onTick);
      sock.off("round:word", onWord);
      sock.off("round:word_count", onWordCount);
      sock.off("round:review", onReview);
      sock.off("round:committed", onCommitted);
      sock.off("connect_error", onConnectError);
      sock.off("disconnect", onDisconnect);
      sock.io.off("reconnect_attempt", onReconnectAttempt);
      sock.off("room:closed", onClosed);
    };
  }, [opts?.wsUrl, opts?.token, opts?.code, opts]);

  useEffect(() => {
    return () => {
      disconnectRoom();
      socketRef.current = null;
    };
  }, []);

  return {
    socket: socketRef.current,
    snapshot,
    status,
    error,
    closedReason,
    tick,
    currentWord,
    wordCount,
    review,
    lastCommitted,
  };
}
