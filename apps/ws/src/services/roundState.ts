// Стейт текущего раунда в Redis. Отдельный ключ от snapshot, чтобы не
// раздувать broadcast'ы при каждом guess'е.
// Ключ: `room:<code>:round` → JSON {RoundState}.

import { redis } from "../redis";
import { ROOM_TTL_SECONDS } from "@alias/shared/constants";

export interface WordSeen {
  wordId: number;
  text: string;
  guessed: boolean | null; // null = ещё на показе, true/false после ack
  order: number;
}

export interface RoundState {
  teamId: number;
  /** userId объясняющего */
  explainerUserId: string;
  playerName: string; // снимок имени (для Round.playerName)
  roundNumber: number;
  durationMs: number;
  startedAt: number; // Date.now() при старте
  pausedAt: number | null;
  pausedTotalMs: number; // суммарно сколько паузы
  wordsSeen: WordSeen[];
  /** id текущего активного слова (показано explainer'у). */
  currentWordId: number | null;
  currentWordText: string | null;
  currentWordOrder: number;
}

const KEY = (code: string) => `room:${code}:round`;

export async function saveRoundState(
  code: string,
  state: RoundState,
): Promise<void> {
  await redis.set(KEY(code), JSON.stringify(state), "EX", ROOM_TTL_SECONDS);
}

export async function loadRoundState(
  code: string,
): Promise<RoundState | null> {
  const raw = await redis.get(KEY(code));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoundState;
  } catch {
    return null;
  }
}

export async function deleteRoundState(code: string): Promise<void> {
  await redis.del(KEY(code));
}

export async function mutateRoundState(
  code: string,
  fn: (state: RoundState) => RoundState | void,
): Promise<RoundState | null> {
  const state = await loadRoundState(code);
  if (!state) return null;
  const next = fn(state) ?? state;
  await saveRoundState(code, next);
  return next;
}

/** Сколько мс осталось в раунде с учётом пауз. */
export function msLeft(state: RoundState, now: number = Date.now()): number {
  const elapsed = now - state.startedAt - state.pausedTotalMs -
    (state.pausedAt ? now - state.pausedAt : 0);
  return Math.max(0, state.durationMs - elapsed);
}
