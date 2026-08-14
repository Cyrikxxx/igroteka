// Шапка приложения (новый дизайн). Самодостаточна: включает .app-header-wrap
// + .shell, поэтому корректно рендерится и внутри AppShell, и отдельно.

import Brand from "./Brand";
import { NavLinks, NavMenu } from "./Nav";

interface HeaderProps {
  /** Контент справа от лого, слева от навигации/темы. */
  right?: React.ReactNode;
  /** Показать навигацию (О нас / Правила / История / Поддержка) — на публичных страницах. */
  nav?: boolean;
}

export function Header({ right, nav }: HeaderProps) {
  return (
    <header className="app-header-wrap">
      <div className="shell">
        <div className="app-header">
          <div className="brand-group">
            <Brand />
            {nav && <NavLinks />}
          </div>
          <div className="header-actions">
            {right}
            {nav && <NavMenu />}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
