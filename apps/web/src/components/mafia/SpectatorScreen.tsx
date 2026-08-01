"use client";

// Экран наблюдателя: мёртвые игроки и зрители видят ход партии со стороны.
// Список игроков (живые/выбывшие), роли — если открыты правилами.

import { Eye } from "lucide-react";
import type { MafiaView } from "@alias/shared/mafia";
import MafiaAvatar from "./MafiaAvatar";
import { RoleChip } from "./roleMeta";
import { fmtClock } from "./PhaseHead";
import { EventFeed } from "./Chronicle";

const PHASE_LABEL: Record<string, string> = {
  NIGHT: "Ночь",
  MORNING: "Утро",
  DISCUSSION: "Обсуждение",
  VOTE: "Голосование",
  VOTE_RESULT: "Итог голосования",
  LAST_WORD: "Последнее слово",
};

export default function SpectatorScreen({ view, exiled }: { view: MafiaView; exiled?: boolean }) {
  const label = PHASE_LABEL[view.phase] ?? view.phase;
  return (
    <>
      <div className="mf-phase-head">
        <div className="mf-phase-title">
          <Eye size={21} color="var(--mf-text-dim)" />
          <span>Наблюдаешь · {label} {view.day || ""}</span>
        </div>
        {view.timer ? <div className="mf-timer" style={{ fontSize: 20 }}>{fmtClock(view.timer.msLeft)}</div> : null}
      </div>

      <div style={{ padding: "8px 20px 4px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            background: "rgba(225,29,72,0.07)",
            border: "1px solid rgba(225,29,72,0.25)",
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--mf-text-dim)",
          }}
        >
          {exiled ? "Город изгнал тебя." : "Ты выбыл из игры."} Смотри, чем всё закончится — не подсказывай.
        </div>
      </div>

      {view.events && view.events.length > 0 ? (
        <div style={{ padding: "14px 20px 0" }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 9 }}>Сейчас</div>
          <EventFeed events={view.events} />
        </div>
      ) : null}

      <div style={{ padding: "14px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 7, overflowY: "auto" }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>Игроки и роли</div>
        {view.players.map((p) => (
          <div
            key={p.userId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "var(--mf-surface)",
              border: "1px solid var(--mf-border)",
              borderRadius: 14,
              padding: "8px 12px",
              opacity: p.alive ? 1 : 0.55,
            }}
          >
            <MafiaAvatar name={p.displayName} idx={p.avatarIdx} size={34} dead={!p.alive} />
            <span
              style={{
                fontWeight: 700,
                fontSize: 14.5,
                flex: 1,
                textDecoration: p.alive ? "none" : "line-through",
                color: p.alive ? "var(--mf-text)" : "var(--mf-text-faint)",
              }}
            >
              {p.displayName}
            </span>
            {p.role ? <RoleChip role={p.role} /> : null}
          </div>
        ))}
      </div>
    </>
  );
}
