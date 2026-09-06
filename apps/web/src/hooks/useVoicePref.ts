"use client";

// Озвучивает ли ЭТО устройство. За столом телефонов много, и хором они
// говорить не должны, поэтому настройка живёт в устройстве, а не в комнате:
// кто ничего не выбирал — молчит, кроме хоста.

import { useCallback, useMemo, useState } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { primeSpeech, speak, cancelSpeech } from "@/lib/narrator";
import {
  loadVoicePref,
  saveVoicePref,
  voiceEnabledFor,
  type VoicePref,
} from "@/lib/voice-prefs";

export interface VoicePrefState {
  on: boolean;
  /**
   * Переключить озвучку здесь. `confirmWith` — короткая фраза, которую скажем
   * при включении: она и подтверждает выбор, и разблокирует синтез на iOS,
   * где первый звук обязан идти из нажатия человека.
   */
  toggle: (confirmWith?: string) => void;
}

export function useVoicePref(isHost: boolean): VoicePrefState {
  const hydrated = useHydrated();
  const stored = useMemo(() => (hydrated ? loadVoicePref() : null), [hydrated]);
  const [choice, setChoice] = useState<VoicePref | null>(null);
  const on = voiceEnabledFor(choice ?? stored, isHost);

  const toggle = useCallback(
    (confirmWith?: string) => {
      const next: VoicePref = on ? "off" : "on";
      if (next === "on") {
        primeSpeech();
        if (confirmWith) speak(confirmWith);
      } else {
        cancelSpeech();
      }
      saveVoicePref(next);
      setChoice(next);
    },
    [on],
  );

  return { on, toggle };
}
