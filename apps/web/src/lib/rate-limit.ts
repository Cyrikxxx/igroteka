// Простое ограничение частоты запросов для REST-роутов.
//
// Счётчики живут в памяти процесса: на одном VPS web — единственный
// контейнер, так что этого достаточно. Если когда-нибудь появится второй
// инстанс, счётчики надо будет перенести в Redis.
//
// Задача скромная: не дать перебирать коды комнат и засыпать базу
// пустыми комнатами. Это не защита от распределённой атаки.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Раз в 10 минут выкидываем протухшие ведёрки, чтобы Map не рос вечно.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
let lastSweep = Date.now();

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Адрес клиента. За реверс-прокси реальный IP приходит в X-Forwarded-For;
 * Caddy его проставляет. Без заголовка все анонимы схлопнутся в один
 * ключ — на домашнем масштабе это приемлемо.
 */
function clientKey(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export interface RateLimitOptions {
  /** Сколько запросов разрешено в окне. */
  limit: number;
  /** Длина окна в секундах. */
  windowSec: number;
  /** Своя корзина на каждый роут, чтобы лимиты не смешивались. */
  name: string;
}

/**
 * Возвращает готовый 429-ответ, если лимит исчерпан, иначе null.
 *
 *   const limited = checkRateLimit(request, { name: "create", limit: 10, windowSec: 60 });
 *   if (limited) return limited;
 */
export function checkRateLimit(
  request: NextRequest,
  opts: RateLimitOptions,
): NextResponse | null {
  const now = Date.now();
  sweep(now);

  const key = `${opts.name}:${clientKey(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowSec * 1000 });
    return null;
  }

  bucket.count += 1;
  if (bucket.count <= opts.limit) return null;

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return NextResponse.json(
    { error: "Слишком много запросов. Попробуйте через минуту." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
