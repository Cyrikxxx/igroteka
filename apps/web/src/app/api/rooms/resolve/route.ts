// GET /api/rooms/resolve?code=XXXXXX — какой игре принадлежит код комнаты.
// Нужен хабу: игрок вводит код, не указывая игру, и должен попасть в нужный
// вход. Отдаёт только платформу — ничего секретного о комнате здесь нет.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isValidRoomCode } from "@/lib/room-code";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  // Единственный эндпоинт, отвечающий «такая комната есть» без авторизации,
  // поэтому именно им удобнее всего перебирать коды.
  const limited = checkRateLimit(request, {
    name: "resolve",
    limit: 30,
    windowSec: 60,
  });
  if (limited) return limited;

  const raw = request.nextUrl.searchParams.get("code") ?? "";
  const code = raw.toUpperCase();
  if (!isValidRoomCode(code)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const room = await prisma.room.findUnique({
    where: { code },
    select: { platform: true, status: true },
  });
  if (!room || room.status === "FINISHED") {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ platform: room.platform });
}
