"use client";

// Хаб игротеки (/). Нейтральная чернильная платформа: обе игры на равных.
// Дизайн — HubMobile/HubDesktop из project-context/mafia-design/mafia/screen-hub.
// Логика: карточки ведут в зоны игр, ввод кода — в join (детект игры — Phase 2).

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";

interface GameCardProps {
  href: string;
  accent: string;
  accentText: string;
  ctaDark?: boolean;
  title: string;
  tagline: string;
  badges: string[];
  meta: string;
}

const ALIAS: GameCardProps = {
  href: "/alias",
  accent: "var(--alias-green)",
  accentText: "var(--alias-green)",
  ctaDark: true,
  title: "Алиас",
  tagline: "Объясняй слова на время",
  badges: ["Онлайн", "Локально"],
  meta: "2–6 команд",
};

const MAFIA: GameCardProps = {
  href: "/mafia/new",
  accent: "var(--mf-crimson)",
  accentText: "var(--mf-crimson)",
  title: "Мафия",
  tagline: "Найди мафию раньше, чем она найдёт тебя",
  badges: ["Онлайн"],
  meta: "5–16 игроков",
};

function GameCard({ card }: { card: GameCardProps }) {
  return (
    <Link href={card.href} className="hub-card">
      <div className="hub-card-glow" style={{ background: card.accent }} />
      <div style={{ display: "flex", gap: 8 }}>
        {card.badges.map((b) => (
          <span key={b} className="mf-chip" style={{ background: "rgba(255,255,255,0.06)" }}>
            {b}
          </span>
        ))}
      </div>
      <div className="hub-card-title" style={{ color: card.accent }}>
        {card.title}
      </div>
      <div className="hub-card-tag">{card.tagline}</div>
      <div className="hub-card-meta">
        <Users size={16} /> {card.meta}
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

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (!c) return;
    // TODO (Phase 2): определять игру по коду и вести в нужный join.
    router.push(`/alias/join?code=${c}`);
  };

  return (
    <div className="hub">
      <div className="hub-inner">
        <div className="hub-brand">
          <span className="hub-dot" style={{ background: "var(--alias-green)" }} />
          <span className="hub-dot" style={{ background: "var(--mf-crimson)" }} />
          <span>ИГРОТЕКА</span>
        </div>

        <h1 className="hub-title">Во что играем сегодня?</h1>

        <div className="hub-cards">
          <GameCard card={ALIAS} />
          <GameCard card={MAFIA} />
        </div>

        <form className="hub-code" onSubmit={go}>
          <span className="hub-code-label">Есть код комнаты?</span>
          <div className="hub-code-row">
            <input
              className="hub-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="K7F2QD"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              aria-label="Код комнаты"
            />
            <button type="submit" className="mf-btn mf-btn-surface" style={{ minWidth: 100 }}>
              Войти
            </button>
          </div>
        </form>

        <div className="hub-footer">
          <Link href="/about">О нас</Link>
          <Link href="/rules">Правила</Link>
          <Link href="/history">История</Link>
        </div>
      </div>
    </div>
  );
}
