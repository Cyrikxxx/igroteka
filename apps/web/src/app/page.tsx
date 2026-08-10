"use client";

// Хаб игротеки (/). Нейтральная чернильная платформа: обе игры на равных.
// Карточки ведут на лендинги игр, поле кода — в нужный вход (игру
// определяет сервер по коду).

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Users, Clock, Loader2 } from "lucide-react";

interface GameCardProps {
  href: string;
  accent: string;
  ctaDark?: boolean;
  title: string;
  tagline: string;
  badges: string[];
  players: string;
  duration: string;
}

// Обе карточки описываются одинаковым набором фактов — иначе одна
// выглядит содержательнее другой, а разница в высоте оставляет дыру.
const ALIAS: GameCardProps = {
  href: "/alias",
  accent: "var(--alias-green)",
  ctaDark: true,
  title: "Алиас",
  tagline: "Объясняй слова на время, пока команда угадывает",
  badges: ["Онлайн", "Локально"],
  players: "2–6 команд",
  duration: "15–30 мин",
};

const MAFIA: GameCardProps = {
  href: "/mafia",
  accent: "var(--mf-crimson)",
  title: "Мафия",
  tagline: "Найди мафию раньше, чем она найдёт тебя",
  badges: ["Онлайн"],
  players: "5–16 игроков",
  duration: "20–40 мин",
};

function GameCard({ card }: { card: GameCardProps }) {
  return (
    <Link href={card.href} className="hub-card">
      <span className="hub-card-edge" style={{ background: card.accent }} />
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

      <div className="hub-card-facts">
        <span>
          <Users size={15} /> {card.players}
        </span>
        <span>
          <Clock size={15} /> {card.duration}
        </span>
      </div>

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

      <main className="hub-inner">
        <h1 className="hub-title">Во что играем сегодня?</h1>

        <div className="hub-cards">
          <GameCard card={ALIAS} />
          <GameCard card={MAFIA} />
        </div>

        <form className="hub-code" onSubmit={go}>
          <label className="hub-code-label" htmlFor="room-code">
            Уже есть код комнаты?
          </label>
          <div className="hub-code-row">
            <input
              id="room-code"
              className="hub-code-input"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
              }
              placeholder="••••••"
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
      </main>

      <footer className="hub-footer">
        <Link href="/about">О нас</Link>
        <Link href="/rules">Правила</Link>
        <Link href="/history">История</Link>
      </footer>
    </div>
  );
}
