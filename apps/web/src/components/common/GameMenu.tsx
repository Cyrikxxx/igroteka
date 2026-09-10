"use client";

// Служебное меню игрового экрана — одно на обе игры.
//
// На экране партии нет места под ряд кнопок, а нужны они редко: поставить
// паузу, оборвать раунд, завершить партию, выйти. Поэтому один вход в углу, а
// внутри — то, что доступно именно тебе сейчас.
//
// Угол правый верхний: в Алиасе на одном устройстве кнопка паузы всегда была
// там, и рука ищет её там же. Внизу слева меню вдобавок перекрывал служебный
// значок Next в режиме разработки — вход было просто не найти.

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface GameMenuItem {
  icon: LucideIcon;
  label: string;
  /** Вторая строка помельче: что случится, если нажать. */
  hint?: string;
  /** Красным — необратимое. */
  danger?: boolean;
  onClick: () => void;
}

export interface GameMenuProps {
  items: GameMenuItem[];
  /** Строка без кнопки — объяснить, почему действия сейчас нет. */
  note?: string;
  /** Подсветить вход: внутри есть то, чего человек ждёт. */
  alert?: boolean;
}

export default function GameMenu({ items, note, alert = false }: GameMenuProps) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Клик мимо и Esc закрывают меню: на телефоне промахнуться легко, а
  // застрявшая панель поверх игры мешает ходить.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0 && !note) return null;

  return (
    <div className="gm" ref={boxRef}>
      <button
        type="button"
        className="gm-btn"
        aria-label={open ? "Закрыть меню" : "Меню игры"}
        aria-expanded={open}
        data-alert={alert ? "" : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={19} /> : <MoreHorizontal size={19} />}
      </button>

      {open ? (
        <div className="gm-sheet" role="menu">
          {items.map(({ icon: Icon, label, hint, danger, onClick }) => (
            <button
              key={label}
              type="button"
              className="gm-item"
              data-danger={danger ? "" : undefined}
              onClick={() => {
                setOpen(false);
                onClick();
              }}
            >
              <Icon size={18} />
              <span className="gm-item-text">
                <span className="gm-item-label">{label}</span>
                {hint ? <span className="gm-item-hint">{hint}</span> : null}
              </span>
            </button>
          ))}
          {note ? <div className="gm-note">{note}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
