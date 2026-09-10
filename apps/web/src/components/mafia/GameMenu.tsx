"use client";

// Что лежит в служебном меню на экране партии Мафии.
//
// Раньше здесь была одна кнопка — пауза, и только у хоста. Всё остальное
// пряталось: «завершить партию» жила внутри паузы, «выйти из игры» не было
// вовсе, а «взять комнату» существовала только в лобби — то есть пропавший
// посреди партии хост подвешивал комнату до самой уборки.
//
// Сама панель общая с Алиасом, см. components/common/GameMenu.

import { Pause, Play, Crown, Flag, LogOut } from "lucide-react";
import Menu, { type GameMenuItem } from "@/components/common/GameMenu";

export interface MafiaGameMenuProps {
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

export default function MafiaGameMenu(props: MafiaGameMenuProps) {
  const items: GameMenuItem[] = [];

  if (props.isHost && props.canPause) {
    items.push({ icon: Pause, label: "Поставить на паузу", onClick: props.onPause });
  }
  if (props.isHost && props.paused) {
    items.push({ icon: Play, label: "Продолжить игру", onClick: props.onResume });
  }
  // Забрать комнату может кто угодно, включая зрителя: иначе комната, где все
  // выбыли, остаётся без хозяина.
  if (props.canClaimHost) {
    items.push({
      icon: Crown,
      label: "Взять комнату",
      hint: "Хоста нет в сети",
      onClick: props.onClaimHost,
    });
  }
  if (props.isHost) {
    items.push({
      icon: Flag,
      label: "Завершить партию",
      hint: "Все вернутся в лобби",
      onClick: props.onEndGame,
    });
  }
  items.push({
    icon: LogOut,
    label: "Выйти из игры",
    hint: "Для тебя партия закончится",
    danger: true,
    onClick: props.onLeave,
  });

  return (
    <Menu
      items={items}
      note={
        props.hostGone && !props.canClaimHost
          ? `Хоста нет в сети. Взять комнату можно через ${props.claimSecondsLeft} с.`
          : undefined
      }
      alert={props.hostGone && !props.isHost}
    />
  );
}
