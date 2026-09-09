"use client";

// Чернильная поверхность зоны Мафии. Всегда «ночная» (тёмная), не зависит
// от темы Алиаса. Контент центрируется в телефоноподобной колонке.

import type { CSSProperties, ReactNode } from "react";

export default function MafiaShell({
  children,
  vignette = false,
  vignetteLevel,
  wide = false,
}: {
  children: ReactNode;
  vignette?: boolean;
  vignetteLevel?: number;
  wide?: boolean;
}) {
  const style: CSSProperties = {
    minHeight: "100dvh",
    width: "100%",
    background: "var(--mf-bg)",
    display: "flex",
    justifyContent: "center",
  };
  // Ширина и масштаб — в CSS (.mf-frame): на больших мониторах телефонная
  // колонка в 560 px выглядит марочной, и её нужно увеличивать целиком,
  // вместе с текстом и карточками. Медиазапросы этого не умеют — размеры
  // внутри экранов заданы в пикселях прямо в разметке.
  const frameStyle: CSSProperties =
    vignetteLevel != null ? ({ "--vignette": vignetteLevel } as CSSProperties) : {};
  return (
    <div style={style}>
      <div
        className={
          "mf-screen mf-frame" +
          (wide ? " mf-frame-wide" : "") +
          (vignette ? " mf-vignette" : "")
        }
        style={frameStyle}
      >
        {children}
      </div>
    </div>
  );
}
