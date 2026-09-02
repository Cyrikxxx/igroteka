"use client";

// Плашка «что случилось с комнатой» на главном экране игры. Показывается
// один раз после того, как человека выгнали или комнату закрыли, и убирается
// крестиком.
//
// Читаем в эффекте, а не при рендере: на сервере sessionStorage нет, и
// обращение к нему прямо в теле компонента разошлось бы с серверной
// разметкой при гидратации.

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { takeRoomNotice, type RoomNotice } from "@/lib/room-notice";

export default function RoomNoticeBanner({
  variant = "alias",
}: {
  /** Оформление под зону: у Мафии своя палитра, она не зависит от темы. */
  variant?: "alias" | "mafia";
}) {
  const [notice, setNotice] = useState<RoomNotice | null>(null);

  useEffect(() => {
    setNotice(takeRoomNotice());
  }, []);

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
