"use client";

// Отсчёт до «взять комнату на себя».
//
// Снапшот в этот момент не меняется — сервер лишь однажды записал время, когда
// хост пропал. Без локального тика кнопка не появилась бы сама, и человеку
// пришлось бы перезагружать страницу, чтобы узнать, что ждать уже нечего.

import { useEffect, useState } from "react";
import { HOST_CLAIM_AFTER_MS } from "@alias/shared/constants";

export interface HostClaimState {
  /** Хоста нет в сети и минута прошла — можно забирать. */
  canClaim: boolean;
  /** Сколько секунд ещё ждать. 0, когда ждать нечего. */
  secondsLeft: number;
  /** Хоста нет в сети — показывать предупреждение, даже пока ждём. */
  hostGone: boolean;
}

export function useHostClaim(
  hostOfflineSince: number | null | undefined,
  isHost: boolean,
): HostClaimState {
  // Себе комнату забирать не у кого, поэтому у хоста таймер вообще не идёт.
  const waiting = !isHost && !!hostOfflineSince;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waiting]);

  if (!waiting || !hostOfflineSince) {
    return { canClaim: false, secondsLeft: 0, hostGone: false };
  }
  const elapsed = now - hostOfflineSince;
  return {
    canClaim: elapsed >= HOST_CLAIM_AFTER_MS,
    secondsLeft: Math.max(0, Math.ceil((HOST_CLAIM_AFTER_MS - elapsed) / 1000)),
    hostGone: true,
  };
}
