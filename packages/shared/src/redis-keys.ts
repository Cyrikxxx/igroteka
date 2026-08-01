// Ключи Redis для онлайн-комнат. Используются и в apps/web, и в apps/ws.

export const roomKey = (code: string) => `room:${code}`;
export const roomWordsKey = (code: string) => `room:${code}:words`;

// ─────────── Мафия (отдельное пространство ключей) ───────────
export const mafiaRoomKey = (code: string) => `mafia:room:${code}`;
