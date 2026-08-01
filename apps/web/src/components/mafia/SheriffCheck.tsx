"use client";

// Проверка шерифа — необратимый ход, поэтому спрашиваем подтверждение,
// а результат показываем отдельным экраном, а не подписью на карточке.
// Порт NightSheriff/SheriffVerdict из mafia-design/mafia/screen-night2.

import { VenetianMask, UserCheck } from "lucide-react";
import MafiaAvatar from "./MafiaAvatar";

/** Диалог «точно проверяем этого?» перед списанием ночи. */
export function SheriffConfirm({
  name,
  avatarIdx,
  onConfirm,
  onCancel,
}: {
  name: string;
  avatarIdx: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 75,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
        background: "rgba(5,5,9,0.72)",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--mf-surface)",
          border: "1px solid var(--mf-border)",
          borderRadius: "var(--r-card)",
          padding: "24px 20px 18px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          boxShadow: "var(--sh-glow-gold)",
          color: "var(--mf-text)",
        }}
      >
        <MafiaAvatar name={name} idx={avatarIdx} size={56} />
        <div style={{ fontWeight: 800, fontSize: 22 }}>Проверить {name}?</div>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--mf-text-faint)", textAlign: "center" }}>
          Проверка одна за ночь. Результат увидишь только ты.
        </div>
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <button type="button" className="mf-btn mf-btn-ghost" style={{ flex: 1 }} onClick={onCancel}>
            Отмена
          </button>
          <button
            type="button"
            className="mf-btn"
            style={{ flex: 1, background: "var(--mf-gold)", color: "#1a1102" }}
            onClick={onConfirm}
          >
            Проверить
          </button>
        </div>
      </div>
    </div>
  );
}

/** Вердикт: крупно и однозначно. */
export function SheriffVerdict({
  name,
  isMafia,
  onClose,
}: {
  name: string;
  isMafia: boolean;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 75,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: "0 28px",
        textAlign: "center",
        background: "var(--mf-bg)",
        color: "var(--mf-text)",
      }}
    >
      <div
        style={{
          width: 104,
          height: 104,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isMafia ? "rgba(225,29,72,0.12)" : "rgba(255,255,255,0.04)",
          border: `1.5px solid ${isMafia ? "var(--mf-crimson)" : "var(--mf-border)"}`,
          color: isMafia ? "var(--mf-crimson)" : "var(--mf-text-dim)",
          boxShadow: isMafia ? "var(--sh-glow-crimson)" : "none",
        }}
      >
        {isMafia ? <VenetianMask size={48} strokeWidth={1.5} /> : <UserCheck size={48} strokeWidth={1.5} />}
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 24, color: "var(--mf-text-dim)" }}>{name} —</div>
        <div
          style={{
            fontWeight: 800,
            fontSize: isMafia ? 52 : 38,
            letterSpacing: isMafia ? "0.02em" : "-0.01em",
            lineHeight: 1.1,
            color: isMafia ? "var(--mf-crimson)" : "var(--mf-text)",
            textShadow: isMafia ? "0 0 44px rgba(225,29,72,0.5)" : "none",
          }}
        >
          {isMafia ? "МАФИЯ" : "не мафия"}
        </div>
      </div>
      <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--mf-text-faint)" }}>
        Это видишь только ты. Используй днём.
      </div>
      <button type="button" className="mf-btn mf-btn-surface" style={{ minWidth: 220, marginTop: 8 }} onClick={onClose}>
        Понятно
      </button>
    </div>
  );
}
