"use client";

// Чернильная поверхность зоны Мафии. Всегда «ночная» (тёмная), не зависит
// от темы Алиаса. Контент центрируется в телефоноподобной колонке.

import type { CSSProperties, ReactNode } from "react";

export default function MafiaShell({
  children,
  vignette = false,
  vignetteLevel,
  wide = false,
  topBar,
  menu,
}: {
  children: ReactNode;
  vignette?: boolean;
  vignetteLevel?: number;
  wide?: boolean;
  /**
   * Шапка платформы. Живёт снаружи колонки, чтобы полоса шла во всю ширину
   * окна: внутри колонки она обрывалась на её краю и логотип съезжал к
   * середине экрана.
   */
  topBar?: ReactNode;
  /**
   * Служебное меню партии. Живёт внутри колонки: прибитое к углу окна, на
   * широком мониторе оно улетало далеко вправо от игры.
   */
  menu?: ReactNode;
}) {
  const style: CSSProperties = {
    minHeight: "100dvh",
    width: "100%",
    background: "var(--mf-bg)",
    display: "flex",
    ...(topBar
      ? { flexDirection: "column" as const, alignItems: "center" }
      : { justifyContent: "center" }),
  };
  // Ширина и масштаб — в CSS (.mf-frame): на больших мониторах телефонная
  // колонка в 560 px выглядит марочной, и её нужно увеличивать целиком,
  // вместе с текстом и карточками. Медиазапросы этого не умеют — размеры
  // внутри экранов заданы в пикселях прямо в разметке.
  const frameStyle: CSSProperties =
    vignetteLevel != null ? ({ "--vignette": vignetteLevel } as CSSProperties) : {};
  return (
    <div style={style}>
      {topBar}
      <div
        className={
          "mf-screen mf-frame" +
          (wide ? " mf-frame-wide" : "") +
          (topBar ? " mf-frame-under-bar" : "") +
          (vignette ? " mf-vignette" : "")
        }
        style={frameStyle}
      >
        {menu}
        {children}
      </div>
    </div>
  );
}
