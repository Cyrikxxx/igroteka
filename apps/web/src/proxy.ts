// Next.js 16: middleware → proxy. Запускается на edge перед каждым запросом.
// Задача — гарантировать httpOnly-cookie `aid` (anonymous device id). Без БД,
// без Prisma: proxy не должен иметь shared modules / global state (см. docs).
// Соответствие БД (запись в `User`) делается в REST-роутах при необходимости.
//
// См. PROMPT.md §2.6.4.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AID = "aid";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function proxy(request: NextRequest) {
  const existing = request.cookies.get(AID)?.value;
  if (existing) return NextResponse.next();

  const id = crypto.randomUUID();
  const response = NextResponse.next();
  response.cookies.set({
    name: AID,
    value: id,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export const config = {
  // Прогоняем через прокси все маршруты, кроме статики и оптимизированных картинок.
  // _next/data специально включён (см. proxy.md): защита API-роутов и SSR.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sounds|assets).*)",
  ],
};
