// Верхняя панель Игротеки — одна на все зоны платформы: экраны Алиаса
// (через AppShell) и страницы «О нас / Правила / История» (через PageShell).
// Раньше у Алиаса была своя шапка с логотипом «alias.online», из-за чего
// переход между играми выглядел как переход на другой сайт.

import Link from "next/link";
import { NavMenu } from "./Nav";
import { NAV_LINKS, SUPPORT_HREF } from "@/constants/site";

interface SiteTopBarProps {
  /** Подсветить активный пункт навигации (подпись ссылки). */
  active?: string;
  /** Контент между брендом и навигацией — индикатор соединения, код комнаты. */
  right?: React.ReactNode;
}

export function SiteTopBar({ active, right }: SiteTopBarProps) {
  return (
    <div className="pl-topbar">
      <Link href="/" className="pl-brand" aria-label="Игротека — на главную">
        <span className="pl-dot" style={{ background: "var(--alias-green)" }} />
        <span className="pl-dot" style={{ background: "var(--mf-crimson)" }} />
        <span>ИГРОТЕКА</span>
      </Link>

      <div className="pl-topbar-right">
        {right}
        <nav className="pl-nav">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={label === active ? "pl-nav-active" : undefined}
            >
              {label}
            </Link>
          ))}
          <a href={SUPPORT_HREF}>Поддержка</a>
        </nav>
        {/* Ниже 900px ряд ссылок скрыт — там навигация живёт в бургере. */}
        <NavMenu />
      </div>
    </div>
  );
}

export default SiteTopBar;
