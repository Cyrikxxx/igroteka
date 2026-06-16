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
  const frameStyle: CSSProperties = {
    width: "100%",
    maxWidth: wide ? 920 : 560,
    minHeight: "100dvh",
    ...(vignetteLevel != null
      ? ({ "--vignette": vignetteLevel } as CSSProperties)
      : {}),
  };
  return (
    <div style={style}>
      <div
        className={"mf-screen" + (vignette ? " mf-vignette" : "")}
        style={frameStyle}
      >
        {children}
      </div>
    </div>
  );
}
