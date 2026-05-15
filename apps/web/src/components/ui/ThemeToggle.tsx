"use client";

// Переключатель темы. Тема хранится в localStorage и применяется до
// гидратации через inline-script в layout.tsx (no-flash).

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "alias.theme";
type Theme = "light" | "dark";

function readInitial(): Theme {
  if (typeof document === "undefined") return "dark";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" ? "light" : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(readInitial());
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage недоступен (приватный режим / квота) — игнорируем.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
      className="w-9 h-9 inline-flex items-center justify-center rounded-md transition-colors"
      style={{
        background: "var(--bg-2)",
        color: "var(--fg-1)",
        border: "1px solid var(--line)",
      }}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export default ThemeToggle;
