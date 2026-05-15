// Ключи Redis для онлайн-комнат. См. PROMPT.md §2.2.3.
// Используются и в apps/web, и в apps/ws.

export const roomKey = (code: string) => `room:${code}`;
export const roomLockKey = (code: string) => `room:${code}:lock`;
export const roomWordsKey = (code: string) => `room:${code}:words`;
export const roomTimerKey = (code: string) => `room:${code}:timer`;
export const codeReverseKey = (code: string) => `code:${code}`;
export const userRoomsKey = (userId: string) => `user:${userId}:rooms`;
