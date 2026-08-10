"use client";

// Хаб игротеки (/). Нейтральная чернильная платформа: обе игры на равных.
// Раскладка повторяет HubDesktop/HubMobile из
// project-context/mafia-design/mafia/screen-hub.jsx.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Users, Loader2 } from "lucide-react";
import type { MafiaRole } from "@alias/shared/mafia";
import { ROLE_META } from "@/components/mafia/roleMeta";

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
  badges: ["Онлайн", "Локально"],
  meta: "2–6 команд",
  filler: <AliasFiller />,
};

const MAFIA: GameCardProps = {
  href: "/mafia",
  accent: "var(--mf-crimson)",
  title: "Мафия",
  tagline: "Найди мафию раньше, чем она найдёт тебя",
  badges: ["Онлайн"],
  meta: "5–16 игроков",
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

  const ready = code.length === 6;

  // Игрок вводит код, не указывая игру, — спрашиваем сервер, чей он.
  // Комнату не нашли — всё равно уводим на вход Алиаса: там человек
  // увидит понятную ошибку вместо молчания.
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/resolve?code=${code}`);
      const platform = res.ok
        ? ((await res.json()) as { platform: string }).platform
        : "ALIAS";
      router.push(
        platform === "MAFIA" ? `/mafia/join?code=${code}` : `/alias/join?code=${code}`,
      );
    } catch {
      router.push(`/alias/join?code=${code}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hub">
      <header className="hub-brand">
        <span className="hub-dot" style={{ background: "var(--alias-green)" }} />
        <span className="hub-dot" style={{ background: "var(--mf-crimson)" }} />
        <span>ИГРОТЕКА</span>
      </header>

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
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
            }
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
      </form>

      <footer className="hub-footer">
        <Link href="/about">О нас</Link>
        <Link href="/rules">Правила</Link>
        <Link href="/history">История</Link>
      </footer>
    </div>
  );
}
