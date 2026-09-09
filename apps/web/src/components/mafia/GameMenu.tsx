"use client";

// Служебное меню игрового экрана.
//
// Раньше на экране партии была одна кнопка — пауза, и только у хоста. Всё
// остальное пряталось: «завершить партию» жила внутри паузы, «выйти из игры»
// не было вовсе, а «взять комнату» существовала только в лобби — то есть
// пропавший посреди партии хост подвешивал комнату до самой уборки.
//
// Теперь один вход в углу, а внутри — то, что доступно именно тебе.

import { useEffect, useRef, useState } from "react";
import {
  MoreHorizontal,
  Pause,
  Play,
  Crown,
  Flag,
  LogOut,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface GameMenuProps {
  isHost: boolean;
  /** Партия идёт и её можно поставить на паузу. */
  canPause: boolean;
  paused: boolean;
  /** Хоста нет в сети и минута прошла. */
  canClaimHost: boolean;
  /** Хоста нет в сети, но ждать ещё столько секунд. */
  claimSecondsLeft: number;
  hostGone: boolean;
  onPause: () => void;
  onResume: () => void;
  onEndGame: () => void;
  onClaimHost: () => void;
  onLeave: () => void;
}

function Item({
  icon: Icon,
  label,
  hint,
  danger = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="mf-menu-item" data-danger={danger ? "" : undefined} onClick={onClick}>
      <Icon size={18} />
      <span className="mf-menu-item-text">
        <span className="mf-menu-item-label">{label}</span>
        {hint ? <span className="mf-menu-item-hint">{hint}</span> : null}
      </span>
    </button>
  );
}

export default function GameMenu(props: GameMenuProps) {
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

  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="mf-menu" ref={boxRef}>
      {open ? (
        <div className="mf-menu-sheet" role="menu">
          {props.isHost && props.canPause ? (
            <Item icon={Pause} label="Поставить на паузу" onClick={act(props.onPause)} />
          ) : null}
          {props.isHost && props.paused ? (
            <Item icon={Play} label="Продолжить игру" onClick={act(props.onResume)} />
          ) : null}

          {/* Забрать комнату может кто угодно, включая зрителя: иначе комната,
              где все выбыли, остаётся без хозяина. */}
          {props.canClaimHost ? (
            <Item
              icon={Crown}
              label="Взять комнату"
              hint="Хоста нет в сети"
              onClick={act(props.onClaimHost)}
            />
          ) : props.hostGone ? (
            <div className="mf-menu-note">
              Хоста нет в сети. Взять комнату можно через {props.claimSecondsLeft} с.
            </div>
          ) : null}

          {props.isHost ? (
            <Item
              icon={Flag}
              label="Завершить партию"
              hint="Все вернутся в лобби"
              onClick={act(props.onEndGame)}
            />
          ) : null}

          <Item
            icon={LogOut}
            label="Выйти из игры"
            hint="Для тебя партия закончится"
            danger
            onClick={act(props.onLeave)}
          />
        </div>
      ) : null}

      <button
        type="button"
        className="mf-menu-btn"
        aria-label={open ? "Закрыть меню" : "Меню игры"}
        aria-expanded={open}
        data-alert={props.hostGone && !props.isHost ? "" : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={19} /> : <MoreHorizontal size={19} />}
      </button>
    </div>
  );
}
