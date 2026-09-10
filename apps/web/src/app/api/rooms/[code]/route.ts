// DELETE /api/rooms/[code] — закрыть комнату (только хост).
//
// GET здесь был раньше и отдавал снимок комнаты кому угодно, без куки и без
// лимита, — вместе с userId всех участников. Читать его давно некому: страница
// комнаты берёт состояние по WebSocket. Удалён как мёртвый код и заодно как
// открытый справочник личностей: код комнаты показывают на экране и шлют в
// мессенджеры, то есть публичен по своей природе.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { readUserId } from "@/lib/identity";
import { isValidRoomCode } from "@/lib/room-code";
import { deleteRoomSnapshot } from "@/lib/room-snapshot";

type Ctx = { params: Promise<{ code: string }> };

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const userId = await readUserId();
    if (!userId) {
      return NextResponse.json({ error: "Identity cookie missing" }, { status: 400 });
    }
    const { code: rawCode } = await params;
    const code = rawCode.toUpperCase();
    if (!isValidRoomCode(code)) {
      return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
    }

    const room = await prisma.room.findUnique({
      where: { code },
      select: { id: true, hostId: true, platform: true },
    });
    // Комната чужой игры — для этого роута её не существует: снимок Мафии
    // лежит в своём пространстве ключей, и удалить его отсюда всё равно не
    // вышло бы — комната осталась бы живой в Redis и мёртвой в Postgres.
    if (!room || room.platform !== "ALIAS") {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    if (room.hostId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.room.update({
      where: { id: room.id },
      data: { status: "FINISHED", endedAt: new Date() },
    });
    await deleteRoomSnapshot(code);

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error("[DELETE /api/rooms/[code]]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
