"use client";

// Момент выбывания. Без него игрока молча перекидывало в режим зрителя,
// и он не понимал, что произошло. Порт YouDead из mafia-design/screen-day.

import { Skull, Eye } from "lucide-react";
import Announce from "./Announce";

export default function YouDeadScreen({
  exiled,
  onWatch,
}: {
  /** true — изгнан голосованием, false — убит ночью. */
  exiled: boolean;
  onWatch: () => void;
}) {
  return (
    <Announce
      icon={Skull}
      iconColor="var(--mf-crimson)"
      glow="var(--sh-glow-crimson)"
      kicker={exiled ? "Голосование окончено" : undefined}
      title={exiled ? "Город изгнал тебя" : "Ты убит"}
      titleColor="var(--mf-crimson)"
      footer={
        <button type="button" className="mf-btn mf-btn-surface" style={{ width: "100%" }} onClick={onWatch}>
          Смотреть как зритель <Eye size={18} />
        </button>
      }
    >
      <div style={{ fontWeight: 600, fontSize: 15, color: "var(--mf-text-dim)", lineHeight: 1.5 }}>
        {exiled ? "Голоса сошлись на тебе." : "Этой ночью тебя не стало."}
        <br />
        Не выдавай свою роль голосом — игра продолжается.
      </div>
    </Announce>
  );
}
