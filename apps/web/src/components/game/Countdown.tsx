"use client";

// Отсчёт 3 · 2 · 1 · GO перед раундом. Дизайн — Countdown из редизайна.

import { useEffect, useState } from "react";

export function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);

  useEffect(() => {
    if (n <= 0) {
      const id = setTimeout(onDone, 650);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setN((x) => x - 1), 900);
    return () => clearTimeout(id);
  }, [n, onDone]);

  return (
    <div className="countdown-overlay">
      <span className="eyebrow">раунд начинается</span>
      <div className="cd-num mono" key={n}>
        {n > 0 ? n : "GO"}
      </div>
      <p className="muted">{n > 0 ? "Приготовься объяснять…" : "Поехали!"}</p>
    </div>
  );
}

export default Countdown;
