"use client";

// Карточка игрока в ночной/дневной сетке. Универсальная: подсветка выбора,
// бейджи (голос, проверка), подпись (напарник / погиб).

import type { ReactNode } from "react";
import MafiaAvatar from "./MafiaAvatar";

export default function PlayerCard({
  name,
  avatarIdx,
  me = false,
  dead = false,
  offline = false,
  picked = false,
  gold = false,
  disabled = false,
  badgeTopRight,
  badgeTopLeft,
  subline,
  onClick,
}: {
  name: string;
  avatarIdx: number;
  me?: boolean;
  dead?: boolean;
  /** Не в сети: карточка гаснет, под именем подпись. */
  offline?: boolean;
  picked?: boolean;
  gold?: boolean;
  disabled?: boolean;
  badgeTopRight?: ReactNode;
  badgeTopLeft?: ReactNode;
  subline?: ReactNode;
  onClick?: () => void;
}) {
  const cls =
    "mf-player-card" +
    (picked ? (gold ? " picked-gold" : " picked") : "") +
    (disabled ? " disabled" : "");
  return (
    <div
      className={cls}
      onClick={disabled ? undefined : onClick}
      style={disabled ? { cursor: "default" } : undefined}
    >
      <MafiaAvatar name={name} idx={avatarIdx} size={42} dead={dead} offline={offline} />
      <div className="mf-player-name" style={dead ? { color: "var(--mf-text-faint)" } : undefined}>
        {name}
        {me ? " (ты)" : ""}
      </div>
      {/* Своя подпись, а не общая: «не в сети» важнее любой другой, потому
          что объясняет, почему человек не ходит. */}
      {offline && !dead ? <div className="mf-player-offline">не в сети</div> : subline}
      {badgeTopRight ? (
        <div style={{ position: "absolute", top: -9, right: 10 }}>{badgeTopRight}</div>
      ) : null}
      {badgeTopLeft ? (
        <div style={{ position: "absolute", top: -9, left: 10 }}>{badgeTopLeft}</div>
      ) : null}
    </div>
  );
}
