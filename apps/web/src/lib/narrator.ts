"use client";

// Голос ведущего: тонкая обёртка над speechSynthesis браузера.
//
// Своих аудиофайлов нет намеренно: реплики называют игроков по именам, и
// записью их не покрыть. Синтез есть не везде и звучит по-разному, поэтому
// всё наружу отдаётся честно — есть ли русский голос вообще.

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
  const voices = s.getVoices();
  if (voices.length === 0) return "unknown";
  return voices.some((v) => v.lang.toLowerCase().startsWith("ru")) ? "ready" : "missing";
}

function pickVoice(): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  const voices = s.getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith("ru")) ?? null;
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
