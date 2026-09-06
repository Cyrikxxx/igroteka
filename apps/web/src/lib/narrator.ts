"use client";

// Голос ведущего: тонкая обёртка над speechSynthesis браузера.
//
// Своих аудиофайлов нет намеренно: реплики называют игроков по именам, и
// записью их не покрыть. Синтез есть не везде и звучит по-разному, поэтому
// всё наружу отдаётся честно — есть ли русский голос вообще.

import { loadVoiceURI } from "./voice-prefs";

/** Разблокирован ли синтез. На iOS первый speak обязан идти из клика. */
let primed = false;

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

export function isSpeechSupported(): boolean {
  return synth() !== null;
}

/**
 * Есть ли русский голос. Список голосов в Chrome приезжает асинхронно, так
 * что сразу после загрузки страницы он может быть пустым — тогда честнее
 * ответить «не знаю» (null), чем пугать надписью «голоса нет».
 */
export function russianVoiceState(): "ready" | "missing" | "unknown" {
  const s = synth();
  if (!s) return "missing";
  if (s.getVoices().length === 0) return "unknown";
  return russianVoices().length > 0 ? "ready" : "missing";
}

/** Фраза для проверки голоса — та же, с которой начинается ночь. */
export const VOICE_SAMPLE = "Город засыпает. Все закрывают глаза.";

/**
 * Русские голоса устройства. Ссылка на массив меняется, только когда меняется
 * сам список: `useSyncExternalStore` сравнивает снимки по ссылке, и новый
 * массив на каждый вызов зациклил бы рендер.
 */
let cachedVoices: SpeechSynthesisVoice[] = [];
let cachedKey = "";

export function russianVoices(): SpeechSynthesisVoice[] {
  const s = synth();
  const ru = (s?.getVoices() ?? []).filter((v) => v.lang.toLowerCase().startsWith("ru"));
  const key = ru.map((v) => v.voiceURI).join("|");
  if (key !== cachedKey) {
    cachedKey = key;
    cachedVoices = ru;
  }
  return cachedVoices;
}

/** Список голосов в Chrome приезжает уже после загрузки страницы. */
export function subscribeVoices(onChange: () => void): () => void {
  const s = synth();
  if (!s) return () => {};
  s.addEventListener("voiceschanged", onChange);
  return () => s.removeEventListener("voiceschanged", onChange);
}

/** Выбранный человеком голос, иначе первый русский. */
function pickVoice(): SpeechSynthesisVoice | null {
  const ru = russianVoices();
  if (ru.length === 0) return null;
  const wanted = loadVoiceURI();
  return ru.find((v) => v.voiceURI === wanted) ?? ru[0];
}

/**
 * Разблокировать синтез. Вызывать строго из обработчика клика: Safari на iOS
 * молчит всю сессию, если первая реплика прозвучала не по жесту человека.
 */
export function primeSpeech(): void {
  const s = synth();
  if (!s || primed) return;
  // Пустая фраза не слышна, но снимает блокировку.
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  s.speak(u);
  primed = true;
}

export function speak(text: string): void {
  const s = synth();
  if (!s) return;
  // Прежнюю реплику обрываем: шаги ночи идут подряд, и очередь из двух
  // фраз означала бы, что ведущий отстаёт от игры.
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ru-RU";
  u.rate = 0.95;
  const voice = pickVoice();
  if (voice) u.voice = voice;
  s.speak(u);
  primed = true;
}

export function cancelSpeech(): void {
  synth()?.cancel();
}
