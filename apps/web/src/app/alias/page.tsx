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
  Home,
  Trees,
  HeartHandshake,
  Briefcase,
  Clapperboard,
  Brain,
  PartyPopper,
  ToyBrick,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import SiteTopBar from "@/components/common/SiteTopBar";
import RoomNoticeBanner from "@/components/common/RoomNoticeBanner";
import {
  MAX_TEAMS,
  MAX_PLAYERS_PER_TEAM,
  TRIO_TEAMS,
  ROUND_TIME_OPTIONS,
} from "@alias/shared/constants";
import { WORD_PACKS, WORD_LEVELS, WORDS_TOTAL } from "@/constants/word-packs";

// Втроём хватает трёх человек, командами набирается шесть на шесть.
const MIN_PLAYERS = TRIO_TEAMS;
const MAX_PLAYERS = MAX_TEAMS * MAX_PLAYERS_PER_TEAM;
const ROUND_MIN = ROUND_TIME_OPTIONS[0];
const ROUND_MAX = ROUND_TIME_OPTIONS[ROUND_TIME_OPTIONS.length - 1];

const STEPS: [LucideIcon, string, string][] = [
  [Users2, "Разделитесь", `Команды по 2–${MAX_PLAYERS_PER_TEAM} человек или режим втроём`],
  [MessageSquareText, "Объясняй слово", "Любыми словами, кроме однокоренных"],
  [Zap, "Команда угадывает", "Свайп вправо — верно, влево — пропуск"],
  [Trophy, "Считай очки", "Круг доигрывают все, потом сайт объявляет победителя"],
];

/**
 * Подборки словаря. Названия, описания и числа — из
 * apps/web/src/constants/word-packs.ts, то есть из настоящего каталога;
 * здесь к ним подбирается иконка (в базе у подборок эмодзи, а карточка
 * нарисована под lucide).
 */
const PACK_STYLE: Record<string, [LucideIcon, string]> = {
  classic: [Home, "var(--pack-classic)"],
  world: [Trees, "var(--pack-kids)"],
  people: [HeartHandshake, "var(--pack-friends)"],
  daily: [Briefcase, "var(--pack-pro)"],
  popculture: [Clapperboard, "var(--pack-movies)"],
  challenge: [Brain, "var(--pack-hard)"],
  holidays: [PartyPopper, "var(--pack-friends)"],
  "kids-mix": [ToyBrick, "var(--pack-kids)"],
};

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
      <SiteTopBar />
      {/* Объяснение для того, кого только что выгнали из комнаты. */}
      <RoomNoticeBanner />
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
              <Users size={14} /> {MIN_PLAYERS}–{MAX_PLAYERS} человек
            </span>
            <span>
              <Smartphone size={14} /> Один телефон или онлайн
            </span>
            <span>
              <Timer size={14} /> Раунд {ROUND_MIN}–{ROUND_MAX} сек
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
          {WORD_PACKS.map((pack) => {
            const [Icon, color] = PACK_STYLE[pack.slug];
            return (
              <div
                key={pack.slug}
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
                    {pack.name}
                  </span>
                  <span className="mf-mono al-pack-count">{pack.words} слов</span>
                </div>
                <div className="al-pack-desc">{pack.desc}</div>
              </div>
            );
          })}
        </div>
        <p className="al-packs-note">
          Всего {WORDS_TOTAL} слов. Темы комбинируются между собой и с уровнями
          сложности ({WORD_LEVELS.join(", ").toLowerCase()}), а счётчик при выборе
          показывает уникальные слова: одно и то же слово живёт сразу в нескольких
          наборах.
        </p>
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
