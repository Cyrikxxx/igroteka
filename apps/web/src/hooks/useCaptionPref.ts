"use client";

// Показывать ли реплики ведущего текстом. Настройка устройства, не комнаты:
// одному плашка нужна, потому что русского голоса на его телефоне нет, другому
// мешает смотреть на игроков.
//
// Устроено как useVoicePref: сохранённое читается только после гидратации —
// на сервере localStorage нет, и разметка разъехалась бы с клиентской.

import { useCallback, useMemo, useState } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { loadCaptionPref, saveCaptionPref } from "@/lib/voice-prefs";

export interface CaptionPrefState {
  on: boolean;
  toggle: () => void;
}

export function useCaptionPref(): CaptionPrefState {
  const hydrated = useHydrated();
  const stored = useMemo(() => (hydrated ? loadCaptionPref() : true), [hydrated]);
  const [choice, setChoice] = useState<boolean | null>(null);
  const on = choice ?? stored;

  const toggle = useCallback(() => {
    saveCaptionPref(!on);
    setChoice(!on);
  }, [on]);

  return { on, toggle };
}
