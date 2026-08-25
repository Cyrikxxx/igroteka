// Собрать новую партию по образцу уже сыгранной. Нужно в трёх местах:
// на финале локальной игры, на странице итогов и в Истории, — поэтому
// логика живёт здесь, а не копируется по экранам.

import type { GameFromAPI, CreateRoomResponse } from "@/types";
import { saveLocalSetup, type LocalSetupState } from "@/lib/local-setup";
import { loadDisplayName, saveRoomCreds } from "@/lib/room-session";

/** Настройки партии в том виде, в каком их принимают /api/games и /api/rooms. */
function settingsOf(game: GameFromAPI) {
  return {
    roundTime: game.roundTime,
    winScore: game.winScore,
    penaltySkip: game.penaltySkip,
    categoryIds: game.gameCategories.map((c) => c.categoryId),
  };
}

/**
 * Локальная игра: те же команды и те же имена. Кладём в sessionStorage и
 * ведём на экран команд — до старта имена ещё можно поправить.
 */
export function prepareLocalRematch(game: GameFromAPI): LocalSetupState {
  const state: LocalSetupState = {
    teams: game.teams.map((t) => ({
      name: t.name,
      players: t.players.map((p) => ({ name: p.name })),
    })),
    settings: settingsOf(game),
  };
  saveLocalSetup(state);
  return state;
}

/**
 * Онлайн: новая комната с теми же правилами. Состав не переносим — людей
 * зовём заново по ссылке, как и в первый раз.
 *
 * Возвращает код комнаты; креды хоста уже сохранены.
 */
export async function createRoomLike(game: GameFromAPI): Promise<string> {
  const hostName = loadDisplayName().trim() || "Хост";
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostName, settings: settingsOf(game) }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Не удалось создать комнату");
  }
  const data: CreateRoomResponse = await res.json();
  saveRoomCreds({
    code: data.room.code,
    wsUrl: data.wsUrl,
    wsToken: data.wsToken,
    userId: data.user.id,
    displayName: data.user.displayName,
  });
  return data.room.code;
}
