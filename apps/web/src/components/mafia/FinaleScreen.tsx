"use client";

// Итоговый экран партии: победитель, раскрытие всех ролей, судьба каждого.

import { VenetianMask, Skull, Shield, Home, RotateCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MafiaView, MafiaWinner, MafiaDeathCause } from "@alias/shared/mafia";
import MafiaAvatar from "./MafiaAvatar";
import { RoleChip } from "./roleMeta";
import { Chronicle } from "./Chronicle";

const WIN_META: Record<MafiaWinner, { title: string; color: string; Icon: LucideIcon }> = {
  city: { title: "Победа города", color: "var(--alias-green)", Icon: Shield },
  mafia: { title: "Победа мафии", color: "var(--mf-crimson)", Icon: VenetianMask },
  maniac: { title: "Победа маньяка", color: "var(--role-maniac)", Icon: Skull },
};

function fate(by?: MafiaDeathCause, day?: number): string {
  if (!by) return "выжил";
  if (by === "mafia") return `убит ночью ${day ?? ""}`.trim();
  if (by === "maniac") return `убит маньяком (ночь ${day ?? ""})`.trim();
  return `изгнан городом (день ${day ?? ""})`.trim();
}

export default function FinaleScreen({
  view,
  isHost,
  onRematch,
  onHome,
}: {
  view: MafiaView;
  isHost: boolean;
  /** Вернуть комнату в лобби тем же составом (только хост). */
  onRematch: () => void;
  onHome: () => void;
}) {
  const winner = view.winner ?? "city";
  const m = WIN_META[winner];
  const Icon = m.Icon;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "44px 24px 24px", textAlign: "center" }}>
        <div
          style={{
            width: 108,
            height: 108,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.04)",
            border: `1.5px solid ${m.color}`,
            color: m.color,
            boxShadow: `0 0 48px ${m.color}`,
          }}
        >
          <Icon size={50} strokeWidth={1.5} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mf-text-faint)" }}>
          Партия окончена
        </div>
        <div style={{ fontWeight: 800, fontSize: 40, letterSpacing: "-0.02em", color: m.color, lineHeight: 1.05 }}>
          {m.title}
        </div>
      </div>

      <div className="mf-finale-body">
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--mf-text-faint)", marginBottom: 2 }}>
            Кто кем был
          </div>
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
              padding: "9px 12px",
            }}
          >
            <MafiaAvatar name={p.displayName} idx={p.avatarIdx} size={36} dead={!p.alive} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.displayName}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--mf-text-faint)" }}>{fate(p.eliminatedBy, p.deathDay)}</div>
            </div>
            {p.role ? <RoleChip role={p.role} /> : null}
          </div>
        ))}
        </div>

        {view.events && view.events.length > 0 ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--mf-text-faint)", margin: "4px 0 10px" }}>
              Хроника партии
            </div>
            <Chronicle events={view.events} />
          </div>
        ) : null}
      </div>

      <div style={{ padding: "14px 20px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {isHost ? (
          <button type="button" className="mf-btn mf-btn-crimson" style={{ width: "100%" }} onClick={onRematch}>
            <RotateCcw size={18} /> Сыграть ещё
          </button>
        ) : (
          <div className="mf-mono" style={{ textAlign: "center", fontSize: 13, color: "var(--mf-text-faint)", fontWeight: 700 }}>
            хост может собрать всех на новую партию
          </div>
        )}
        <button type="button" className="mf-btn mf-btn-ghost" style={{ width: "100%" }} onClick={onHome}>
          <Home size={18} /> На главную
        </button>
      </div>
    </div>
  );
}
