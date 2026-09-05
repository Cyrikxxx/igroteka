"use client";

// Экран выдачи роли: карта «прижми и держи» (3D-флип). Отпустил — рубашка.

import { useState } from "react";
import { Fingerprint, VenetianMask } from "lucide-react";
import type { MafiaRole } from "@alias/shared/mafia";
import { ROLE_META } from "./roleMeta";

function CardFace({ role, partners }: { role: MafiaRole; partners?: string[] }) {
  const m = ROLE_META[role];
  const Icon = m.Icon;
  const isGold = role === "don" || role === "sheriff";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 24,
        background: "linear-gradient(170deg, #16161f 0%, #101018 100%)",
        border: `2px solid ${m.color}`,
        boxShadow: `0 0 44px ${isGold ? "rgba(245,158,11,0.35)" : "rgba(225,29,72,0.30)"}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 24,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: "rotateY(180deg)",
      }}
    >
      <div
        style={{
          width: 92,
          height: 92,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.05)",
          border: `1.5px solid ${m.color}`,
          color: m.color,
        }}
      >
        <Icon size={46} strokeWidth={1.6} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 34, letterSpacing: "0.02em", color: m.color, textTransform: "uppercase" }}>
          {m.label}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mf-text-faint)", marginTop: 4 }}>
          {m.team}
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--mf-text-dim)", textAlign: "center", lineHeight: 1.5 }}>
        {m.task}
      </div>
      {partners && partners.length > 0 ? (
        <div
          style={{
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(225,29,72,0.1)",
            border: "1px solid rgba(225,29,72,0.3)",
            borderRadius: 999,
            padding: "7px 14px",
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          <VenetianMask size={15} color="var(--mf-crimson)" />
          <span>Напарники: {partners.join(" · ")}</span>
        </div>
      ) : null}
    </div>
  );
}

function CardBack() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 24,
        background: "repeating-linear-gradient(135deg, #13131c 0px, #13131c 10px, #101018 10px, #101018 20px)",
        border: "2px solid rgba(225,29,72,0.4)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
    >
      <div
        style={{
          width: 86,
          height: 86,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1.5px solid rgba(225,29,72,0.45)",
          color: "rgba(225,29,72,0.65)",
        }}
      >
        <VenetianMask size={42} strokeWidth={1.5} />
      </div>
    </div>
  );
}

export default function RoleReveal({
  role,
  partners,
  ready,
  readyCount,
  total,
  onReady,
  isHost,
  onStartNight,
  onEndGame,
}: {
  role: MafiaRole;
  partners?: string[];
  ready: boolean;
  readyCount: number;
  total: number;
  onReady: () => void;
  isHost: boolean;
  /** Начать ночь, не дожидаясь всех: кто-то мог закрыть вкладку. */
  onStartNight: () => void;
  /** Оборвать партию и вернуться в лобби. */
  onEndGame: () => void;
}) {
  const [held, setHeld] = useState(false);
  const open = held;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ textAlign: "center", padding: "26px 24px 0" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mf-text-faint)" }}>
          Твоя роль
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "0 24px" }}>
        <div
          onPointerDown={() => setHeld(true)}
          onPointerUp={() => setHeld(false)}
          onPointerLeave={() => setHeld(false)}
          onPointerCancel={() => setHeld(false)}
          onContextMenu={(e) => e.preventDefault()}
          style={{ width: 270, height: 396, perspective: 1100, cursor: "pointer", touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              transformStyle: "preserve-3d",
              transition: "transform 0.35s cubic-bezier(0.2, 0.8, 0.25, 1)",
              transform: open ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            <CardBack />
            <CardFace role={role} partners={partners} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--mf-text-dim)", fontSize: 14.5, fontWeight: 700, opacity: open ? 0 : 1, transition: "opacity 0.2s" }}>
          <Fingerprint size={17} />
          Прижми и держи, чтобы увидеть роль
        </div>
      </div>
      <div style={{ padding: "0 20px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          className="mf-btn mf-btn-crimson"
          style={{ opacity: ready ? 0.5 : 1 }}
          disabled={ready}
          onClick={onReady}
        >
          {ready ? "Ждём остальных…" : "Я запомнил"}
        </button>
        <div className="mf-mono" style={{ textAlign: "center", fontSize: 13, color: "var(--mf-text-faint)", fontWeight: 700 }}>
          Готовы {readyCount} из {total}
        </div>
        {/* Кто-то мог закрыть вкладку, не нажав «готов». Без этой кнопки
            партия ждала бы его возвращения вечно. */}
        {isHost && readyCount < total ? (
          <>
            <button
              type="button"
              className="mf-btn mf-btn-ghost"
              style={{ fontSize: 14 }}
              onClick={onStartNight}
            >
              Начать ночь без остальных
            </button>
            {/* Второй выход: если ждать бессмысленно — оборвать партию и
                вернуться в лобби, где отвалившихся можно просто убрать из
                состава. Раньше отсюда завершить было нельзя вовсе: кнопка
                жила только в оверлее паузы, а на этой фазе паузы нет. */}
            <button
              type="button"
              className="mf-btn mf-btn-ghost"
              style={{ fontSize: 14 }}
              onClick={onEndGame}
            >
              Завершить партию и вернуться в лобби
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
