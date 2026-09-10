"use client";

// Хаб игротеки (/). Нейтральная чернильная платформа: обе игры на равных.
// Раскладка повторяет HubDesktop/HubMobile из
// project-context/mafia-design/mafia/screen-hub.jsx.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Users, Loader2 } from "lucide-react";
import type { MafiaRole } from "@alias/shared/mafia";
import { MIN_MAFIA_PLAYERS, MAX_MAFIA_PLAYERS } from "@alias/shared/mafia";
import {
  MAX_TEAMS,
  MAX_PLAYERS_PER_TEAM,
  TRIO_TEAMS,
} from "@alias/shared/constants";
import { ROLE_META } from "@/components/mafia/roleMeta";
import SiteTopBar from "@/components/common/SiteTopBar";
import {
  ROOM_CODE_LENGTH,
  WRONG_LAYOUT_HINT,
  pasteCode,
  typeCode,
} from "@/lib/room-code-input";
import { resolveRoomGame, resolveErrorText } from "@/lib/room-platform";

/** Слова-примеры на карточке Алиаса: показывают, из чего состоит игра. */
const SAMPLE_WORDS = [
  "жираф",
  "космос",
  "сквозняк",
  "оркестр",
  "карамель",
  "пельмень",
  "маяк",
];

/** Роли Мафии в том же порядке, что в прототипе. */
const ROLE_ORDER: MafiaRole[] = [
  "mafia",
  "don",
  "sheriff",
  "doctor",
  "maniac",
  "civilian",
];

function AliasFiller() {
  return (
    <div className="hub-words">
      {SAMPLE_WORDS.map((w, i) => (
        <span
          key={w}
          className="hub-word"
          // Каждое третье слово — акцентом, чтобы ряд не выглядел серой массой.
          style={{ color: i % 3 === 0 ? "var(--alias-green)" : "var(--mf-text-dim)" }}
        >
          {w}
        </span>
      ))}
    </div>
  );
}

function MafiaFiller() {
  return (
    <div className="hub-roles">
      {ROLE_ORDER.map((role) => {
        const meta = ROLE_META[role];
        const Icon = meta.Icon;
        return (
          <span
            key={role}
            className="hub-role"
            title={meta.label}
            style={{ borderColor: meta.color, color: meta.color }}
          >
            <Icon size={20} strokeWidth={1.8} />
          </span>
        );
      })}
    </div>
  );
}

interface GameCardProps {
  href: string;
  accent: string;
  ctaDark?: boolean;
  title: string;
  tagline: string;
  badges: string[];
  meta: string;
  filler: React.ReactNode;
}

const ALIAS: GameCardProps = {
  href: "/alias",
  accent: "var(--alias-green)",
  ctaDark: true,
  title: "Алиас",
  tagline: "Объясняй слова на время",
  badges: ["Онлайн", "Локально", "Втроём"],
  // Втроём хватает трёх человек, командами набирается шесть на шесть.
  meta: `${TRIO_TEAMS}–${MAX_TEAMS * MAX_PLAYERS_PER_TEAM} человек`,
  filler: <AliasFiller />,
};

const MAFIA: GameCardProps = {
  href: "/mafia",
  accent: "var(--mf-crimson)",
  title: "Мафия",
  tagline: "Найди мафию раньше, чем она найдёт тебя",
  badges: ["Онлайн", "Режим ведущего"],
  meta: `${MIN_MAFIA_PLAYERS}–${MAX_MAFIA_PLAYERS} игроков`,
  filler: <MafiaFiller />,
};

function GameCard({ card }: { card: GameCardProps }) {
  return (
    <Link href={card.href} className="hub-card">
      <span className="hub-card-glow" style={{ background: card.accent }} />

      <div className="hub-card-badges">
        {card.badges.map((b) => (
          <span key={b} className="hub-badge">
            {b}
          </span>
        ))}
      </div>

      <h2 className="hub-card-title" style={{ color: card.accent }}>
        {card.title}
      </h2>
      <p className="hub-card-tag">{card.tagline}</p>

      <div className="hub-card-meta">
        <Users size={16} /> {card.meta}
      </div>

      {/* Нижний блок прижат к кнопке: он и заполняет карточку, и подсказывает,
          что внутри игры. На узких экранах прячется — там места нет. */}
      <div className="hub-card-filler">{card.filler}</div>

      <span
        className="hub-card-cta"
        style={{ background: card.accent, color: card.ctaDark ? "#06130a" : "#fff" }}
      >
        Играть <ArrowRight size={19} />
      </span>
    </Link>
  );
}

export default function HubPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrongLayout, setWrongLayout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = code.length === ROOM_CODE_LENGTH;

  const onType = (raw: string) => {
    const { code: next, wrongLayout: bad } = typeCode(raw);
    setCode(next);
    setWrongLayout(bad);
    setError(null);
  };
  // Вставку чиним молча: код мог быть скопирован уже в чужой раскладке.
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = pasteCode(e.clipboardData.getData("text"));
    if (!pasted) return;
    e.preventDefault();
    setCode(pasted);
    setWrongLayout(false);
    setError(null);
  };

  // Проверяем код, не уходя со страницы. Раньше хаб на любой ответ уводил на
  // вход — и на опечатку тоже, где та превращалась в «комнаты больше нет,
  // код освободился». Человек при этом терял набранное и оказывался в игре,
  // которую не выбирал. Ошибка теперь остаётся здесь, вместе с полем.
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const outcome = await resolveRoomGame(code);
    if (!outcome.game) {
      setError(resolveErrorText(outcome.reason));
      setBusy(false);
      return;
    }
    // Игру уже знаем — передаём её входу цветом, чтобы страница открылась
    // сразу в оформлении той комнаты, куда человек идёт.
    router.push(`/join?code=${code}&from=${outcome.game}`);
  };

  return (
    <div className="hub">
      <SiteTopBar />

      <div className="hub-body">
      <h1 className="hub-title">Во что играем сегодня?</h1>

      <div className="hub-cards">
        <GameCard card={ALIAS} />
        <GameCard card={MAFIA} />
      </div>

      <form className="hub-code" onSubmit={go}>
        <label className="hub-code-label" htmlFor="room-code">
          Есть код комнаты?
        </label>
        <div className="hub-code-row">
          <input
            id="room-code"
            className="hub-code-input"
            value={code}
            onChange={(e) => onType(e.target.value)}
            onPaste={onPaste}
            placeholder="K7F2QD"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            aria-label="Код комнаты из шести символов"
          />
          <button
            type="submit"
            className="hub-code-btn"
            disabled={!ready || busy}
            aria-busy={busy}
          >
            {busy ? <Loader2 size={18} className="hub-spin" /> : "Войти"}
          </button>
        </div>
        {wrongLayout && <p className="code-layout-hint">{WRONG_LAYOUT_HINT}</p>}
        {error && <p className="hub-code-err">{error}</p>}
      </form>

      <footer className="hub-footer">
        <Link href="/about">О нас</Link>
        <Link href="/rules">Правила</Link>
        <Link href="/history">История</Link>
      </footer>
      </div>
    </div>
  );
}
