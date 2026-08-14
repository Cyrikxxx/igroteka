// Главный экран Алиаса: герой с карточкой слова, «Как играть», наборы слов.
// Реализация макета project-context/mafia-design/alias/screen-landing.jsx.
// Старая версия страницы — в project-context/archive/alias-landing-old.

import Link from "next/link";
import {
  Sparkles,
  Users,
  Users2,
  Smartphone,
  Timer,
  MessageSquareText,
  Zap,
  Trophy,
  Book,
  Flame,
  ToyBrick,
  Clapperboard,
  Briefcase,
  Skull,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const STEPS: [LucideIcon, string, string][] = [
  [Users2, "Собери команды", "Два и больше — раздели друзей поровну"],
  [MessageSquareText, "Объясняй слово", "Любыми словами, кроме однокоренных"],
  [Zap, "Команда угадывает", "Свайп вправо — верно, влево — пропуск"],
  [Trophy, "Считай очки", "Первая команда до 50 очков забирает партию"],
];

/**
 * Витрина наборов слов. Пока это статичный список из макета: в базе лежат
 * другие категории, их наполнение будет переделано под эти наборы отдельно.
 */
const PACKS: [string, LucideIcon, string, string, string][] = [
  [
    "Классика",
    Book,
    "var(--pack-classic)",
    "1200 слов",
    "Простые слова на каждый день",
  ],
  ["Для своих", Flame, "var(--pack-friends)", "640 слов", "Мемы, сленг и неловкие темы"],
  ["Детский", ToyBrick, "var(--pack-kids)", "480 слов", "Без сложных понятий, от 6 лет"],
  ["Кино", Clapperboard, "var(--pack-movies)", "520 слов", "Фильмы, сериалы и герои"],
  ["Профессии", Briefcase, "var(--pack-pro)", "350 слов", "Кем работают и что делают"],
  ["Хардкор", Skull, "var(--pack-hard)", "300 слов", "Абстракции, термины, редкие слова"],
];

/** Наклонённая карточка слова — витрина того, что видит объясняющий. */
function WordCard() {
  return (
    <div className="al-wordcard" aria-hidden="true">
      <div className="al-wordcard-top">
        <span className="al-chip al-chip-green">Классика</span>
        <span className="mf-timer al-wordcard-timer">0:38</span>
      </div>
      <div className="al-wordcard-word">Маяк</div>
      <div className="al-wordcard-ban">
        <div className="al-wordcard-ban-label">Нельзя говорить</div>
        <div className="al-wordcard-ban-list">
          {["море", "свет", "корабль"].map((w) => (
            <span key={w} className="al-chip al-chip-faint">
              {w}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AliasLandingPage() {
  return (
    <div className="al-landing">
      <div className="al-landing-inner">
      <section className="al-hero">
        <div className="al-hero-copy">
          <span className="al-chip al-chip-green">
            <Sparkles size={14} /> Классика в Игротеке
          </span>
          <h1 className="al-hero-title">АЛИАС</h1>
          <p className="al-hero-lead">Объясняй слова на время — команда угадывает</p>

          <div className="al-hero-ctas">
            <Link href="/alias/local/new" className="mf-btn mf-btn-green">
              На одном устройстве
            </Link>
            <Link href="/alias/room/new" className="mf-btn mf-btn-surface">
              Онлайн-комната
            </Link>
            <Link href="/alias/join" className="mf-btn mf-btn-ghost">
              Войти по коду
            </Link>
          </div>

          <div className="al-hero-facts">
            <span>
              <Users size={14} /> 2–6 команд
            </span>
            <span>
              <Smartphone size={14} /> Один телефон или онлайн
            </span>
            <span>
              <Timer size={14} /> Раунд 60 сек
            </span>
          </div>
        </div>

        <WordCard />
      </section>

      <section className="al-section">
        <h2 className="al-section-title">Как играть</h2>
        <div className="al-steps">
          {STEPS.map(([Icon, title, sub], i) => (
            <div key={title} className="al-card al-step">
              <div className="al-step-head">
                <span className="mf-mono al-step-num">0{i + 1}</span>
                <Icon size={21} color="var(--mf-text-dim)" />
              </div>
              <div>
                <div className="al-step-title">{title}</div>
                <div className="al-step-sub">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="al-section al-section-last">
        <h2 className="al-section-title">Наборы слов</h2>
        <div className="al-packs">
          {PACKS.map(([name, Icon, color, count, desc]) => (
            <div
              key={name}
              className="al-card al-pack"
              style={{ borderColor: `color-mix(in srgb, ${color} 35%, transparent)` }}
            >
              <span
                className="al-pack-ic"
                style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
              >
                <Icon size={22} strokeWidth={1.8} />
              </span>
              <div className="al-pack-head">
                <span className="al-pack-name" style={{ color }}>
                  {name}
                </span>
                <span className="mf-mono al-pack-count">{count}</span>
              </div>
              <div className="al-pack-desc">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="al-landing-foot">
        <Link href="/" className="mf-btn mf-btn-ghost">
          ← В Игротеку
        </Link>
      </div>
      </div>
    </div>
  );
}
