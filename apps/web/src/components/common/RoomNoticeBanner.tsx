"use client";

// Уведомление «что случилось с комнатой» на главном экране игры. Показывается
// один раз после того, как человека выгнали или комнату закрыли: закрывается
// крестиком и само пропадает через пять секунд.
//
// Всплывает поверх страницы, а не встаёт в поток: раньше это была плашка в
// разметке, и появление сдвигало весь лендинг вниз.
//
// Содержимое монтируем только в браузере: на сервере sessionStorage нет, а
// само сообщение одноразовое — takeRoomNotice его стирает при чтении.


import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { takeRoomNotice, type RoomNotice } from "@/lib/room-notice";
import { useHydrated } from "@/hooks/useHydrated";

export default function RoomNoticeBanner({
  variant = "alias",
}: {
  /** Оформление под зону: у Мафии своя палитра, она не зависит от темы. */
  variant?: "alias" | "mafia";
}) {
  // На сервере хранилища нет, а сообщение к тому же одноразовое — поэтому
  // содержимое монтируем только в браузере.
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return <Banner variant={variant} />;
}

/** Сколько висит уведомление, если его не закрыли руками. */
const AUTO_HIDE_MS = 5000;

function Banner({ variant }: { variant: "alias" | "mafia" }) {
  // Читаем один раз при монтировании: takeRoomNotice стирает сообщение, и
  // второй раз его уже не будет.
  const [notice, setNotice] = useState<RoomNotice | null>(() => takeRoomNotice());

  // Само пропадает: сообщение одноразовое и прочитывается за секунду, а
  // висеть поверх страницы до перезагрузки ему незачем.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), AUTO_HIDE_MS);
    return () => clearTimeout(id);
  }, [notice]);

  if (!notice) return null;

  return (
    <div role="status" className="room-toast" data-variant={variant}>
      <AlertTriangle size={17} style={{ flex: "none" }} />
      <span style={{ flex: 1 }}>{notice.text}</span>
      <button
        type="button"
        className="room-notice-x"
        onClick={() => setNotice(null)}
        aria-label="Закрыть уведомление"
      >
        <X size={16} />
      </button>
    </div>
  );
}
