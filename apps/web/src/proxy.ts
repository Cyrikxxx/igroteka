// Next.js 16: middleware переименован в proxy. Запускается перед каждым
// запросом и гарантирует httpOnly-cookie `aid` (анонимный id устройства).
// Без БД и Prisma: здесь нельзя держать shared-модули и глобальное состояние.
// Запись соответствующего `User` делается в REST-роутах при необходимости.
//
// Кука подписана (см. lib/aid-cookie.ts). Кука с чужой или отсутствующей
// подписью не «чинится», а заменяется новой личностью: иначе достаточно было
// бы прислать чужой id, чтобы им стать.
//
// Выставленная здесь кука видна и роуту в этом же запросе, поэтому подделка
// не отлетает ошибкой, а просто оказывается новым анонимом с пустой историей.
// Гейт всё равно двойной: readUserId() проверяет подпись сам, так что запрос
// мимо прокси не пройдёт.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { issueAid, verifyAid } from "@/lib/aid-cookie";

const AID = "aid";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function proxy(request: NextRequest) {
  const existing = request.cookies.get(AID)?.value;
  if (await verifyAid(existing)) return NextResponse.next();

  const { cookie } = await issueAid();
  const response = NextResponse.next();
  response.cookies.set({
    name: AID,
    value: cookie,
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
