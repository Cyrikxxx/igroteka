// Рамка страницы. Фиксированная высота вьюпорта (.app), шапка вне скролла,
// один внутренний скролл-контейнер (.app-scroll) — контент влезает без
// прокрутки на больших экранах, нет вертикальной пустоты.

import { cn } from "@/lib/utils";
import Header from "./Header";

interface AppShellProps {
  /** Контент справа в шапке (пилюли статуса, код комнаты и т.п.). */
  right?: React.ReactNode;
  /** Скрыть кнопку «История» в шапке. */
  hideHistory?: boolean;
  /** Без шапки вообще (иммерсивный игровой экран со своим .game-top). */
  noHeader?: boolean;
  /** Центрировать контент по вертикали (короткие экраны: hero, лобби, pass, финал). */
  centered?: boolean;
  /**
   * Без обёртки `.shell .screen` — страница сама управляет содержимым скролл-области
   * (нужно игровому экрану с `.game-screen`, который заполняет всю высоту).
   */
  bare?: boolean;
  /** Доп. классы на внутренней обёртке `.shell`. */
  className?: string;
  children: React.ReactNode;
}

export function AppShell({ right, hideHistory, noHeader, centered, bare, className, children }: AppShellProps) {
  return (
    <div className="app">
      {!noHeader && <Header right={right} hideHistory={hideHistory} />}
      <div className="app-scroll">
        {bare ? (
          children
        ) : (
          <div className={cn("shell", centered ? "center-screen" : "screen", className)}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export default AppShell;
