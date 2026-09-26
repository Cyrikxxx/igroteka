// Снапшот комнаты Алиаса в Redis (ключ room:<code>).
// Общая механика чтения/записи — @igroteka/shared/server/snapshot-store.
//
// Поверх общей механики здесь считается ревизия: каждая запись поднимает
// `rev`. По нему клиент отбрасывает устаревшие `room:state` — дебаунсенная
// рассылка успевает прочитать снимок до смены фазы, а отправить после, и без
// номера такой снимок неотличим от свежего.
//
// Обёрнут именно Алиас, а не общий store: Мафии это пока не нужно, и трогать
// её ради этого незачем.

import { roomKey } from "@igroteka/shared/redis-keys";
import type { RoomSnapshot } from "@igroteka/shared/alias";
import { createSnapshotStore } from "@igroteka/shared/server/snapshot-store";
import { roomSnapshotTtl } from "@igroteka/shared/snapshot-builders";
import { redis } from "../../redis";

const store = createSnapshotStore<RoomSnapshot>(redis, roomKey, roomSnapshotTtl);

export const { load, remove } = store;

function bumpRev(s: RoomSnapshot): void {
  s.rev = (s.rev ?? 0) + 1;
}

export async function mutate(
  code: string,
  fn: (s: RoomSnapshot) => void,
): Promise<RoomSnapshot | null> {
  return store.mutate(code, (s) => {
    fn(s);
    bumpRev(s);
  });
}

export async function save(snap: RoomSnapshot): Promise<void> {
  bumpRev(snap);
  return store.save(snap);
}
