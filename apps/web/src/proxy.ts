// Next.js 16: middleware переименован в proxy. Запускается перед каждым
// запросом и гарантирует httpOnly-cookie `aid` (анонимный id устройства).
// Без БД и Prisma: здесь нельзя держать shared-модули и глобальное состояние.
// Запись соответствующего `User` делается в REST-роутах при необходимости.

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
  // Прогоняем через прокси все маршруты, кроме статики и оптимизированных
  // картинок. `_next/data` специально не исключён — cookie нужна и на SSR.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
