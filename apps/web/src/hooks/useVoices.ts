"use client";

// Русские голоса устройства. Список приезжает асинхронно (Chrome отдаёт его
// уже после загрузки страницы), поэтому подписываемся на событие, а не
// читаем один раз.
//
// useSyncExternalStore — потому что на сервере голосов нет вовсе, и читать их
// при первом рендере нельзя: разметка разъедется с клиентской.

import { useSyncExternalStore } from "react";
import { russianVoices, subscribeVoices } from "@/lib/narrator";

const NONE: SpeechSynthesisVoice[] = [];

export function useVoices(): SpeechSynthesisVoice[] {
  return useSyncExternalStore(subscribeVoices, russianVoices, () => NONE);
}
