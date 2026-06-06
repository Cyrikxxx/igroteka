// Шапка приложения (новый дизайн). Самодостаточна: включает .app-header-wrap
// + .shell, поэтому корректно рендерится и внутри AppShell, и отдельно.

import Link from "next/link";
import { History } from "lucide-react";
import Brand from "./Brand";
import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  /** Контент справа от лого, слева от переключателя темы. */
  right?: React.ReactNode;
  /** Скрыть кнопку «История» (напр. на самом экране истории). */
  hideHistory?: boolean;
}

export function Header({ right, hideHistory }: HeaderProps) {
  return (
    <header className="app-header-wrap">
      <div className="shell">
        <div className="app-header">
          <Brand />
          <div className="header-actions">
            {right}
            {!hideHistory && (
              <Link
                href="/history"
                className="btn btn-secondary btn-sm header-hist"
                aria-label="История игр"
                title="История игр"
              >
                <History size={16} />
                <span className="hist-label">История</span>
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
