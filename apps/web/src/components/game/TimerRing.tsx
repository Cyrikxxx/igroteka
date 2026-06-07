// Круговой таймер раунда (SVG). Дизайн — TimerRing из редизайна.

interface TimerRingProps {
  /** Осталось секунд. */
  value: number;
  /** Всего секунд в раунде. */
  total: number;
  danger?: boolean;
}

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TimerRing({ value, total, danger }: TimerRingProps) {
  const S = 200;
  const r = S / 2 - 9;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  const col = danger ? "var(--danger)" : "var(--accent)";
  return (
    <div className={"timer-ring game-timer" + (danger ? " danger" : "")}>
      <svg viewBox={`0 0 ${S} ${S}`} width="100%" height="100%">
        <circle cx={S / 2} cy={S / 2} r={r} stroke="var(--bg-3)" strokeWidth={9} fill="none" />
        <circle
          cx={S / 2}
          cy={S / 2}
          r={r}
          stroke={col}
          strokeWidth={9}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1s linear, stroke .3s" }}
        />
      </svg>
      <span className="t-val">{fmt(Math.max(0, value))}</span>
    </div>
  );
}

export default TimerRing;
