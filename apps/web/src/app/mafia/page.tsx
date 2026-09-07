// Лендинг Мафии: нуар-хиро, «как играть», режим ведущего и сетка ролей.
// Порт MafiaLanding из project-context/mafia-design/mafia/screen-landing.

import Link from "next/link";
import {
  Sparkles,
  DoorOpen,
  VenetianMask,
  Moon,
  Vote,
  Users,
  Wifi,
  Bot,
  ListOrdered,
  Volume2,
  Armchair,
  type LucideIcon,
} from "lucide-react";
import type { MafiaRole } from "@alias/shared/mafia";
import { MIN_MAFIA_PLAYERS, MAX_MAFIA_PLAYERS } from "@alias/shared/mafia";
import MafiaShell from "@/components/mafia/MafiaShell";
import SiteTopBar from "@/components/common/SiteTopBar";
import RoomNoticeBanner from "@/components/common/RoomNoticeBanner";
import { ROLE_META } from "@/components/mafia/roleMeta";

export const metadata = {
  title: "Мафия — Игротека",
  description:
    "Найди мафию раньше, чем она найдёт тебя. Онлайн на 5–16 игроков, с режимом ведущего: сайт ведёт ночь и говорит вслух.",
};

const STEPS: [LucideIcon, string, string][] = [
  [DoorOpen, "Создай комнату", "Скинь код друзьям — телефоны вместо карточек"],
  [VenetianMask, "Получи тайную роль", "Прижми карту, запомни, никому не показывай"],
  [Moon, "Ночью роли действуют", "Мафия выбирает, доктор лечит, шериф проверяет"],
  [Vote, "Днём — спор и голосование", "Обсуждайте голосом и изгоняйте подозреваемых"],
];

/** Режим ведущего: ради него в мафию можно играть, сидя за одним столом. */
const NARRATOR: [LucideIcon, string, string][] = [
  [
    ListOrdered,
    "Ночь по шагам",
    "Роли просыпаются по очереди, а не все разом. Мёртвую роль сайт зовёт так же, как живую, — иначе её смерть была бы слышна.",
  ],
  [
    Volume2,
    "Сайт говорит вслух",
    "Голосом устройства: «Просыпается мафия». Голос выбирается в лобби, а озвучку можно включить у себя на любом телефоне.",
  ],
  [
    Armchair,
    "За одним столом",
    "Ведущий-человек не нужен, и никто не сидит в стороне. Телефон нужен только на свой ход — остальное время глаза закрыты.",
  ],
];

const ROLES: [MafiaRole, string][] = [
  ["mafia", "Ночью убирает горожан — примерно один на трёх игроков"],
  ["don", "Появляется при двух и более мафиях, его голос решающий"],
  ["sheriff", "Каждую ночь проверяет одного: мафия или нет"],
  ["doctor", "Лечит одного за ночь, себя — один раз за партию"],
  ["maniac", "Играет сам за себя. Включается в настройках"],
  ["civilian", "Слушает, спорит, вычисляет мафию днём"],
];

export default function MafiaLandingPage() {
  return (
    <MafiaShell wide vignette vignetteLevel={0.1}>
      <div className="mf-landing">
        <SiteTopBar />
        {/* Объяснение для того, кого только что выгнали из комнаты. */}
        <RoomNoticeBanner variant="mafia" />
        <section className="mf-hero">
          <span className="mf-chip mf-hero-chip">
            <Sparkles size={14} /> Новая игра в Игротеке
          </span>
          <h1 className="mf-hero-title">МАФИЯ</h1>
          <p className="mf-hero-sub">Найди мафию раньше, чем она найдёт тебя</p>
          <div className="mf-hero-actions">
            <Link href="/mafia/new" className="mf-btn mf-btn-crimson">
              Создать комнату
            </Link>
            <Link href="/mafia/join" className="mf-btn mf-btn-ghost">
              Войти по коду
            </Link>
          </div>
          <div className="mf-hero-facts">
            <span>
              <Users size={14} /> {MIN_MAFIA_PLAYERS}–{MAX_MAFIA_PLAYERS} игроков
            </span>
            <span>
              <Wifi size={14} /> Онлайн
            </span>
            <span>
              <Bot size={14} /> Режим ведущего
            </span>
          </div>
        </section>

        <section className="mf-section">
          <h2>Как играть</h2>
          <div className="mf-steps">
            {STEPS.map(([Icon, title, sub], i) => (
              <div key={title} className="mf-step">
                <div className="mf-step-head">
                  <span className="mf-mono mf-step-num">0{i + 1}</span>
                  <Icon size={21} />
                </div>
                <div>
                  <div className="mf-step-title">{title}</div>
                  <div className="mf-step-sub">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mf-section">
          <h2>Режим ведущего</h2>
          {/* Сетка ролей на три колонки — три карточки ложатся в неё ровно.
              Пятым шагом это не сделать: .mf-steps жёстко четырёхколоночная. */}
          <div className="mf-roles">
            {NARRATOR.map(([Icon, title, desc]) => (
              <div
                key={title}
                className="mf-role-card"
                style={{ borderColor: "color-mix(in srgb, var(--mf-gold) 35%, transparent)" }}
              >
                <div
                  className="mf-role-icon"
                  style={{
                    background: "color-mix(in srgb, var(--mf-gold) 12%, transparent)",
                    color: "var(--mf-gold)",
                  }}
                >
                  <Icon size={22} strokeWidth={1.8} />
                </div>
                <div className="mf-role-name" style={{ color: "var(--mf-gold)" }}>
                  {title}
                </div>
                <div className="mf-role-desc">{desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mf-section">
          <h2>Роли</h2>
          <div className="mf-roles">
            {ROLES.map(([key, desc]) => {
              const m = ROLE_META[key];
              const Icon = m.Icon;
              return (
                <div
                  key={key}
                  className="mf-role-card"
                  style={{ borderColor: `color-mix(in srgb, ${m.color} 35%, transparent)` }}
                >
                  <div
                    className="mf-role-icon"
                    style={{ background: `color-mix(in srgb, ${m.color} 12%, transparent)`, color: m.color }}
                  >
                    <Icon size={22} strokeWidth={1.8} />
                  </div>
                  <div className="mf-role-name" style={{ color: m.color }}>
                    {m.label}
                  </div>
                  <div className="mf-role-desc">{desc}</div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mf-landing-foot">
          <Link href="/" className="mf-btn mf-btn-ghost">
            ← В Игротеку
          </Link>
        </div>
      </div>
    </MafiaShell>
  );
}
