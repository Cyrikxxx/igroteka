"use client";

// Карточка игрока в ночной/дневной сетке. Универсальная: подсветка выбора,
// плашки по углам, подпись под именем.
//
// Два правила, общие для всех экранов партии:
//
//   • Слева сверху — мой выбор, в цвете своей роли. Раньше он показывался
//     по-разному: ночью плашкой, днём строкой под именем, — и одна и та же
//     карточка выглядела двумя разными.
//   • Справа сверху — чужие голоса: счётчик днём, имена напарников ночью.
//
// Высота карточки постоянная. Строка под именем есть всегда, пустая или нет,
// поэтому «не в сети» больше не раздувает карточку и не сдвигает аватар.

import type { ReactNode } from "react";
import MafiaAvatar from "./MafiaAvatar";

/** Сколько карточек помещается в ряд, не становясь марочными. */
const WIDE_GRID_FROM = 7;

/**
 * Сетка карточек. До шести игроков — две колонки, дальше три: иначе список
 * не влезает в экран и его приходится прокручивать посреди хода. Узкие
 * экраны остаются на двух — там третья колонка режет имена (см. globals.css).
 */
export function PlayerGrid({
  count,
  children,
}: {
  /** Сколько карточек внутри. */
  count: number;
  children: ReactNode;
}) {
  return (
    <div
      className="mf-player-grid"
      data-cols={count >= WIDE_GRID_FROM ? 3 : 2}
      style={{ flex: 1, alignContent: "start" }}
    >
      {children}
    </div>
  );
}

/**
 * Плашка «мой выбор» в цвете роли.
 *
 * Фон непрозрачный: плашка висит на верхней грани карточки и наполовину
 * лежит на фоне страницы — сквозь полупрозрачный был бы виден шов.
 */
export function ChoiceChip({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span
      className="mf-choice-chip"
      style={{
        background: `color-mix(in srgb, ${color} 22%, var(--mf-bg))`,
        borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
        color,
      }}
    >
      {children}
    </span>
  );
}

export default function PlayerCard({
  name,
  avatarIdx,
  me = false,
  dead = false,
  offline = false,
  picked = false,
  gold = false,
  disabled = false,
  choice,
  badgeTopRight,
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
  /** Мой выбор — плашка слева сверху. */
  choice?: ReactNode;
  /** Чужие голоса — плашка справа сверху. */
  badgeTopRight?: ReactNode;
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
      {/* Строка занята всегда — тем и держится высота. «Не в сети» важнее
          остальных подписей: она объясняет, почему человек не ходит. */}
      <div className="mf-player-sub">
        {offline && !dead ? (
          <span className="mf-player-offline">не в сети</span>
        ) : (
          subline
        )}
      </div>
      {choice ? <div className="mf-card-badge left">{choice}</div> : null}
      {badgeTopRight ? <div className="mf-card-badge right">{badgeTopRight}</div> : null}
    </div>
  );
}
