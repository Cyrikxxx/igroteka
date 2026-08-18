// Рамка экранов Алиаса. Фиксированная высота вьюпорта (.app) и один
// внутренний скролл-контейнер (.app-scroll) — контент влезает без прокрутки
// на больших экранах, нет вертикальной пустоты.
//
// Шапки здесь нет намеренно. Навигация по сайту живёт на «сайтовых»
// страницах — хаб, лендинги игр, «О нас / Правила / История». Как только
// человек начал собирать партию, ссылки наружу только мешают: из лобби по
// ним легко случайно выйти и потерять комнату. Выход с каждого экрана даёт
// его собственная кнопка «назад», как это устроено в Мафии.

import { cn } from "@/lib/utils";

interface AppShellProps {
  /** Центрировать контент по вертикали (короткие экраны: лобби, pass, финал). */
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

export function AppShell({ centered, bare, className, children }: AppShellProps) {
  return (
    <div className="app">
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
