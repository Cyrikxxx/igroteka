// Жизненный цикл записи комнаты в Postgres — общий для Алиаса и Мафии.
//
// Live-состояние партии живёт в Redis, но строка Room решает, пустят ли в
// комнату по коду через REST: FINISHED отвечает 410. Поэтому «сыграть ещё»
// обязано вернуть комнату в LOBBY, иначе позвать в неё нового человека уже
// не выйдет, хотя в комнате идёт сбор на следующую партию.

import prisma from "../prisma";

/** Партия доиграна либо хост закрыл комнату — код освобождается. */
export async function closeRoom(code: string): Promise<void> {
  await prisma.room
    .updateMany({
      where: { code },
      data: { status: "FINISHED", endedAt: new Date() },
    })
    .catch(() => {});
  // Вместе с комнатой закрываем и партию. Иначе она навсегда остаётся «в
  // процессе»: в истории такая партия зовёт «продолжить» в комнату, которой
  // уже нет. Досрочно оборванная партия попадает сюда же — счёт в ней
  // сохранён, дописывать нечего.
  await prisma.game
    .updateMany({
      where: { room: { code }, status: "IN_PROGRESS" },
      data: { status: "FINISHED", finishedAt: new Date() },
    })
    .catch(() => {});
}

/** «Сыграть ещё»: комната снова принимает игроков по тому же коду. */
export async function reopenRoom(code: string): Promise<void> {
  await prisma.room
    .updateMany({
      where: { code },
      data: { status: "LOBBY", endedAt: null, startedAt: null },
    })
    .catch(() => {});
}
