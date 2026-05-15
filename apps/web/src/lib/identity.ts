// Идентификация устройства через httpOnly-cookie `aid` (см. PROMPT.md §2.6.4).
// Cookie ставится в proxy.ts (см. /src/proxy.ts). Здесь — серверные хелперы для
// REST-роутов: достать userId из cookie и при необходимости создать запись User.

import { cookies } from "next/headers";
import prisma from "./prisma";

export const AID_COOKIE = "aid";

export type Identity = { userId: string };

/** Чтение userId из cookie. Cookie всегда установлена proxy.ts. */
export async function readUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(AID_COOKIE)?.value ?? null;
}

/**
 * Гарантирует, что в БД есть User с этим id и заданным displayName.
 * Используется при создании комнаты / при первом сохранении игры.
 * Если User уже есть — обновляет displayName, если он пустой или клиент прислал новый.
 */
export async function ensureUser(userId: string, displayName: string): Promise<void> {
  await prisma.user.upsert({
    where: { id: userId },
    update: { displayName },
    create: { id: userId, displayName },
  });
}

/** Бросает 401-friendly ошибку, если cookie не выставлена. */
export async function requireUserId(): Promise<string> {
  const id = await readUserId();
  if (!id) throw new Error("NO_AID_COOKIE");
  return id;
}
