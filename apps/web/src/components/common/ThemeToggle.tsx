"use client";

// Переключатель темы — сегментированный контрол (.seg) из прототипа.
// Тема хранится в localStorage и применяется до гидратации через
// inline-script в layout.tsx (no-flash).

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

  const apply = (next: Theme) => {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage недоступен (приватный режим / квота) — игнорируем.
    }
  };

  return (
    <div className="seg" role="group" aria-label="Тема">
      <button
        type="button"
        className={theme === "dark" ? "on" : ""}
        onClick={() => apply("dark")}
        aria-pressed={theme === "dark"}
        title="Тёмная"
      >
        <Moon />
      </button>
      <button
        type="button"
        className={theme === "light" ? "on" : ""}
        onClick={() => apply("light")}
        aria-pressed={theme === "light"}
        title="Светлая"
      >
        <Sun />
      </button>
    </div>
  );
}

export default ThemeToggle;
