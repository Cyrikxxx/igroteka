"use client";

// Ведущий говорит вслух. Текст приходит готовым с сервера — здесь только
// решение «произносить ли на этом устройстве» и техника воспроизведения.
//
// Реплика произносится по смене ключа: состояние комнаты прилетает много раз
// подряд, а сказать надо один раз. Ключ считает сервер, он же поднимает
// счётчик повторов после паузы, когда роль нужно вызвать теми же словами.

import { useEffect, useRef } from "react";
import { speak, cancelSpeech } from "@/lib/narrator";

/** Экран телефона-ведущего не должен гаснуть посреди ночи. */
interface WakeLockLike {
  release(): Promise<void>;
}
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request(type: "screen"): Promise<WakeLockLike> };
};

function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return;

    let lock: WakeLockLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const next = await nav.wakeLock!.request("screen");
        if (cancelled) void next.release().catch(() => {});
        else lock = next;
      } catch {
        // Отказали (батарея, фон вкладки) — не беда, просто экран погаснет.
      }
    };
    // Блокировка слетает, когда вкладку уводят в фон, — возвращаем её.
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

export function useNarrator(args: {
  narration?: { key: string; text: string };
  /** Озвучивает ли это устройство. */
  enabled: boolean;
  /** На паузе ведущий молчит. */
  paused?: boolean;
}): void {
  const { narration, enabled, paused = false } = args;
  const key = narration?.key ?? null;
  const text = narration?.text ?? "";
  const spokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || paused || !key) return;
    if (spokenRef.current === key) return;
    spokenRef.current = key;
    speak(text);
  }, [enabled, paused, key, text]);

  // Звук выключили или встали на паузу — обрываем фразу на полуслове.
  useEffect(() => {
    if (enabled && !paused) return;
    cancelSpeech();
  }, [enabled, paused]);

  // Уход со страницы посреди реплики: браузер договорил бы её и в фоне.
  useEffect(() => () => cancelSpeech(), []);

  useWakeLock(enabled);
}
