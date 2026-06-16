"use client";

// Навигация публичных страниц.
// NavLinks — десктоп: ряд ссылок (слева, у логотипа).
// NavMenu  — мобайл: бургер + выпадающее меню (справа, перед темой).
// «Поддержка» — mailto (связь с автором, без бэкенда).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { supportMailto } from "@/constants/site";

const LINKS = [
  { href: "/about", label: "О нас" },
  { href: "/rules", label: "Правила" },
  { href: "/history", label: "История" },
];

export function NavLinks() {
  return (
    <div className="main-nav">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="nav-link">
          {l.label}
        </Link>
      ))}
      <a href={supportMailto()} className="nav-link">
        Поддержка
      </a>
    </div>
  );
}

export function NavMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="nav" ref={ref}>
      <button
        type="button"
        className="nav-burger"
        aria-label="Меню"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X /> : <Menu />}
      </button>
      {open && (
        <div className="nav-menu">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="nav-menu-link" onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <a href={supportMailto()} className="nav-menu-link" onClick={() => setOpen(false)}>
            Поддержка
          </a>
        </div>
      )}
    </div>
  );
}
