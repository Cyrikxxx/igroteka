"use client";

// «Мы уже в браузере?» — одним стабильным флагом.
//
// localStorage и sessionStorage на сервере не существуют, поэтому читать их
// при первом рендере нельзя: серверная разметка разъедется с клиентской, и
// React ругнётся на гидратацию (ровно так ломалось лобби Мафии). Раньше это
// обходили эффектом с setState — лишняя перерисовка и претензия линтера.
//
// useSyncExternalStore создан ровно для этого: он берёт значение для сервера
// отдельно от клиентского и переключается сам, без эффекта. Подписка пустая —
// флаг меняется ровно один раз, при гидратации.

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * false на сервере и на первом клиентском рендере, дальше true. Всё, что
 * читает браузерное хранилище, должно ждать этого флага.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, onClient, onServer);
}
