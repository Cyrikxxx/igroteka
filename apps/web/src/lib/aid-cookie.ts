// Подпись куки `aid` — анонимной личности устройства.
//
// Кука и есть единственное доказательство, что ты это ты: по ней отдаётся
// история партий, роли в Мафии и право удалять свои игры. Пока она была
// голым UUID, сервер верил ей на слово, и знание чужого id означало полный
// доступ к чужому аккаунту. Подпись это закрывает: подделать её, не зная
// секрета, нельзя, а значит утёкший id сам по себе ничего не стоит.
//
// Web Crypto, а не node:crypto: модуль импортирует и proxy.ts (Edge-рантайм,
// где node:crypto недоступен), и серверные роуты. Одна реализация на оба
// места — иначе форматы разъедутся, и это выяснится в проде.

/** `<uuid>.<подпись>`. Точка в UUID не встречается, так что делим по ней. */
const SEP = ".";

const encoder = new TextEncoder();
let cachedKey: Promise<CryptoKey> | null = null;

function secret(): string {
  const value = process.env.WS_TOKEN_SECRET;
  if (!value) {
    throw new Error(
      "WS_TOKEN_SECRET не задан — нечем подписывать куку aid. См. .env.example",
    );
  }
  return value;
}

function hmacKey(): Promise<CryptoKey> {
  cachedKey ??= crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return cachedKey;
}

function b64url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(userId: string): Promise<string> {
  const mac = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(userId));
  return b64url(mac);
}

/**
 * Сравнение за постоянное время. Обычное === выходит на первом же различии,
 * и по времени ответа можно подбирать подпись побайтно.
 */
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Значение куки для нового устройства. */
export async function issueAid(): Promise<{ userId: string; cookie: string }> {
  const userId = crypto.randomUUID();
  return { userId, cookie: `${userId}${SEP}${await sign(userId)}` };
}

/**
 * userId из куки — или null, если подписи нет, она чужая или кука старая
 * (до введения подписи). Старые куки намеренно не принимаются: как раз их
 * значения и утекли дампом базы.
 */
export async function verifyAid(cookie: string | undefined): Promise<string | null> {
  if (!cookie) return null;
  const dot = cookie.indexOf(SEP);
  if (dot <= 0) return null;
  const userId = cookie.slice(0, dot);
  const signature = cookie.slice(dot + 1);
  if (!userId || !signature) return null;
  return equal(await sign(userId), signature) ? userId : null;
}
