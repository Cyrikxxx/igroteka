// Шапка фазы Мафии: иконка + название + таймер.

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function PhaseHead({
  icon: Icon,
  title,
  timerMs,
  gold = false,
  iconColor,
  menu,
}: {
  icon: LucideIcon;
  title: string;
  timerMs?: number | null;
  gold?: boolean;
  /** Свой цвет иконки: у наблюдателя она приглушённая, а не малиновая. */
  iconColor?: string;
  /**
   * Служебное меню партии. Стоит здесь, а не накладкой в углу экрана: там оно
   * ложилось ровно на таймер — обе стороны держатся правого края.
   */
  menu?: ReactNode;
}) {
  return (
    <div className="mf-phase-head">
      <div className="mf-phase-title">
        <Icon size={22} color={iconColor ?? (gold ? "var(--mf-gold)" : "var(--mf-crimson)")} />
        <span>{title}</span>
      </div>
      <div className="mf-phase-right">
        {timerMs != null ? (
          <div className="mf-timer" style={{ fontSize: 22, color: "var(--mf-text)" }}>
            {fmtClock(timerMs)}
          </div>
        ) : null}
        {menu}
      </div>
    </div>
  );
}
