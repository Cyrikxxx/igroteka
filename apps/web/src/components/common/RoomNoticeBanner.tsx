"use client";

// Плашка «что случилось с комнатой» на главном экране игры. Показывается
// один раз после того, как человека выгнали или комнату закрыли, и убирается
// крестиком.
//
// Содержимое монтируем только в браузере: на сервере sessionStorage нет, а
// само сообщение одноразовое — takeRoomNotice его стирает при чтении.


import { useState } from "react";
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

function Banner({ variant }: { variant: "alias" | "mafia" }) {
  // Читаем один раз при монтировании: takeRoomNotice стирает сообщение, и
  // второй раз его уже не будет.
  const [notice, setNotice] = useState<RoomNotice | null>(() => takeRoomNotice());

  if (!notice) return null;

  const mafia = variant === "mafia";
  return (
    <div
      role="status"
      className={mafia ? "mf-notice" : "notice notice-danger room-notice"}
      style={mafia ? undefined : { marginBottom: 18 }}
    >
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
