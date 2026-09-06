"use client";

// Озвучивает ли ЭТО устройство. Настройка не комнаты, а телефона: за столом
// восемь телефонов, и если заговорят все, будет каша с разбегом в полсекунды.
//
// По умолчанию говорит устройство хоста; остальные молчат, но любой может
// включить звук у себя и положить телефон в центр стола.

const KEY = "alias.mafiaVoice";
const VOICE_KEY = "alias.mafiaVoiceName";

export type VoicePref = "on" | "off";

export function loadVoicePref(): VoicePref | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw === "on" || raw === "off" ? raw : null;
  } catch {
    return null;
  }
}

export function saveVoicePref(pref: VoicePref): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // Приватный режим — переживём, настройка не критична.
  }
}

/** Человек ничего не выбирал — говорит хост. */
export function voiceEnabledFor(pref: VoicePref | null, isHost: boolean): boolean {
  return pref ? pref === "on" : isHost;
}

/**
 * Каким голосом читать. Голоса ставит операционная система, у каждого
 * устройства свой набор — поэтому выбор тоже живёт в устройстве, а не в
 * комнате. Храним voiceURI: имена у разных движков совпадают.
 */
export function loadVoiceURI(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
}

export function saveVoiceURI(uri: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VOICE_KEY, uri);
  } catch {
    // Приватный режим — переживём, вернётся голос по умолчанию.
  }
}
