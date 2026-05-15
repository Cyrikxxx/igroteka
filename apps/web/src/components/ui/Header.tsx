// Шапка приложения. Тема переключается через ThemeToggle.

import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  /** Контент справа от лого и переключателя темы. */
  right?: React.ReactNode;
}

export function Header({ right }: HeaderProps) {
  return (
    <header
      className="flex items-center justify-between px-4 md:px-8 h-14"
      style={{ background: "var(--bg-1)", borderBottom: "1px solid var(--line)" }}
    >
      <Link href="/" className="flex items-center gap-3">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          <span className="text-sm font-extrabold">A</span>
        </div>
        <div className="leading-tight">
          <div className="font-extrabold tracking-tight flex items-center gap-2">
            Alias
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--accent)" }}
            />
            <span style={{ color: "var(--fg-2)" }} className="font-medium">
              online
            </span>
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        {right}
        <ThemeToggle />
      </div>
    </header>
  );
}

export default Header;
