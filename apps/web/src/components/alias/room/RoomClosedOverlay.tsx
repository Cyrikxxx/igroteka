"use client";

// Комнаты больше нет: хост её закрыл или выгнал этого игрока. Раньше в таком
// случае экран просто застывал на устаревшем снапшоте — человек не понимал,
// что произошло, и продолжал жать кнопки впустую.

import { useRouter } from "next/navigation";
import { DoorOpen } from "lucide-react";
import Modal from "@/components/common/Modal";
import { clearRoomCreds } from "@/lib/room-session";

export default function RoomClosedOverlay({
  open,
  reason,
  code,
}: {
  open: boolean;
  /** Готовый текст причины из useRoom (уже человеческий, не код события). */
  reason: string | null;
  code: string;
}) {
  const router = useRouter();
  return (
    <Modal isOpen={open} fullscreen>
      <div style={{ textAlign: "center" }}>
        <DoorOpen size={40} style={{ color: "var(--fg-3)", marginBottom: 12 }} />
        <h2 className="h-title" style={{ marginBottom: 8 }}>
          Комната закрыта
        </h2>
        <p className="muted">{reason ?? "Комнаты больше нет."}</p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 22 }}
          onClick={() => {
            clearRoomCreds(code);
            router.push("/alias");
          }}
        >
          Выйти к Алиасу
        </button>
      </div>
    </Modal>
  );
}
