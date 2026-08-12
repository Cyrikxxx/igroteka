"use client";

// Страница «Правила»: табы Алиас / Мафия — факты, порядок партии, роли,
// спорные моменты. Порт mafia-design/platform/screen-rules.jsx.

import { useState } from "react";
import {
  Sparkles,
  VenetianMask,
  MessageSquareText,
  Users2,
  Eye,
  Crown,
  Search,
  HeartPulse,
  Skull,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PageShell, {
  PageHead,
  SectionTitle,
  InkCard,
  PageFooter,
} from "@/components/platform/PageShell";

interface RuleSet {
  accent: string;
  lead: string;
  facts: [string, string][];
  steps: [string, string][];
  rolesTitle: string;
  roles: [LucideIcon, string, string, string][];
  disputes: [string, string][];
}

const ALIAS: RuleSet = {
  accent: "var(--alias-green)",
  lead: "Одна команда объясняет слова, другая угадывает. Побеждает команда, первой набравшая нужное число очков.",
  facts: [
    ["Игроков", "4–24"],
    ["Команд", "2–6"],
    ["Раунд", "60 сек"],
    ["Цель", "50 очков"],
  ],
  steps: [
    ["Соберите команды", "Разделитесь поровну, минимум по два человека. Название команды можно поменять перед стартом."],
    ["Выберите набор слов", "Классика, Для своих, Детский, Кино, Профессии или Хардкор. Наборы можно комбинировать."],
    ["Объясняйте на время", "Ведущий объясняет слово любыми словами, кроме однокоренных и перевода. Команда называет варианты вслух."],
    ["Считайте очки", "Угаданное слово — плюс очко, пропуск — минус очко. Ход переходит к следующей команде."],
    ["Доведите до цели", "Партия заканчивается, когда команда набирает цель по очкам. Все команды доигрывают круг до конца."],
  ],
  rolesTitle: "Кто что делает",
  roles: [
    [MessageSquareText, "Объясняющий", "var(--alias-green)", "Говорит про слово всё, кроме однокоренных, перевода и первой буквы."],
    [Users2, "Команда", "var(--al-lime, #a3e635)", "Называет варианты вслух, без ограничений по числу попыток."],
    [Eye, "Соперники", "var(--mf-text-dim)", "Следят за нарушениями и отменяют спорное слово большинством."],
  ],
  disputes: [
    ["Однокоренные слова", "Слово не засчитывается, ход продолжается. Штрафа сверх этого нет."],
    ["Слово угадали после сигнала", "Засчитывается, если объяснение началось до конца таймера."],
    ["Жесты и звуки", "По умолчанию запрещены. Разрешить можно, но договоритесь до начала партии."],
    ["Пропуск слова", "Стоит минус очко. Число пропусков за раунд не ограничено."],
    ["Ничья по очкам", "Играется дополнительный раунд для команд с равным счётом."],
  ],
};

const MAFIA: RuleSet = {
  accent: "var(--mf-crimson)",
  lead: "Город спит — мафия убивает. Днём город обсуждает и голосует. Побеждает сторона, оставшаяся в большинстве.",
  facts: [
    ["Игроков", "5–16"],
    ["Мафия", "1 на 3–4 игрока"],
    ["Ночь", "30 сек"],
    ["День", "3–5 мин"],
  ],
  steps: [
    ["Раздайте роли", "Роли приходят на телефоны игроков и видны только владельцу. Ведущий не обязателен."],
    ["Ночь", "Мафия выбирает жертву, шериф проверяет одного игрока, доктор лечит. Всё вслепую, через экран."],
    ["Утро", "Город узнаёт, кто выбыл ночью. Роль выбывшего показывается по настройке партии."],
    ["Обсуждение", "Каждый говорит по очереди: версии, подозрения, оправдания. Таймер общий на день."],
    ["Голосование", "Город выбирает, кого выгнать. Игра идёт до победы одной из сторон."],
  ],
  rolesTitle: "Роли",
  roles: [
    [VenetianMask, "Мафия", "var(--role-mafia)", "Ночью выбирает жертву, днём притворяется мирным."],
    [Crown, "Дон", "var(--mf-gold)", "Глава мафии: его голос решает при споре внутри команды."],
    [Search, "Шериф", "var(--role-sheriff)", "Каждую ночь проверяет одного игрока: мафия или нет."],
    [HeartPulse, "Доктор", "var(--role-doctor)", "Спасает одного игрока за ночь, себя — не чаще раза за партию."],
    [Skull, "Маньяк", "var(--role-maniac)", "Играет сам за себя и убивает по одному каждую ночь."],
    [User, "Мирный житель", "var(--role-civilian)", "Ничего не умеет ночью, всё решает голосом днём."],
  ],
  disputes: [
    ["Равное число голосов", "Игроки с равным счётом говорят по 30 секунд, затем переголосование. Второе равенство — никто не выбывает."],
    ["Мафия убивает своего", "Разрешено: ход засчитывается как обычное убийство."],
    ["Доктор вылечил жертву", "Ночь проходит без выбывших, город не узнаёт, кого спасали."],
    ["Игрок раскрыл роль", "Раскрывать роль словами можно, доказывать — нечем: приложение подсказок не даёт."],
    ["Выбывший подсказывает", "После выбывания чат закрыт. Подсказки живым считаются нарушением."],
  ],
};

type Tab = "alias" | "mafia";

const TABS: [Tab, string, string, LucideIcon][] = [
  ["alias", "Алиас", "var(--alias-green)", Sparkles],
  ["mafia", "Мафия", "var(--mf-crimson)", VenetianMask],
];

export default function RulesPage() {
  const [tab, setTab] = useState<Tab>("alias");
  const data = tab === "alias" ? ALIAS : MAFIA;

  return (
    <PageShell active="Правила">
      <PageHead title="Правила" lead={data.lead} />

      <div className="pl-rules-top">
        <div className="pl-tabs" role="tablist" aria-label="Выбор игры">
          {TABS.map(([key, label, color, Icon]) => {
            const on = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(key)}
                className={"pl-tab" + (on ? " pl-tab-on" : "")}
                style={
                  on
                    ? {
                        background: `color-mix(in srgb, ${color} 14%, transparent)`,
                        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
                        color,
                      }
                    : undefined
                }
              >
                <Icon size={16} /> {label}
              </button>
            );
          })}
        </div>

        <div className="pl-facts">
          {data.facts.map(([label, value]) => (
            <InkCard key={label} className="pl-fact">
              <div className="mf-mono pl-fact-value" style={{ color: data.accent }}>
                {value}
              </div>
              <div className="pl-fact-label">{label}</div>
            </InkCard>
          ))}
        </div>
      </div>

      <section className="pl-section">
        <SectionTitle note="ПОРЯДОК ПАРТИИ">Как играть</SectionTitle>
        <InkCard className="pl-list">
          {data.steps.map(([title, text], i) => (
            <div key={title} className="pl-step">
              <span className="mf-mono pl-step-num" style={{ color: data.accent }}>
                0{i + 1}
              </span>
              <div className="pl-step-body">
                <div className="pl-card-title">{title}</div>
                <p className="pl-text">{text}</p>
              </div>
            </div>
          ))}
        </InkCard>
      </section>

      <section className="pl-section">
        <SectionTitle>{data.rolesTitle}</SectionTitle>
        <div className="pl-grid-3">
          {data.roles.map(([Icon, name, color, text]) => (
            <InkCard key={name} style={{ gap: 9 }}>
              <span
                className="pl-role-ic"
                style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
              >
                <Icon size={20} strokeWidth={1.8} />
              </span>
              <div className="pl-card-title" style={{ color }}>
                {name}
              </div>
              <p className="pl-text">{text}</p>
            </InkCard>
          ))}
        </div>
      </section>

      <section className="pl-section">
        <SectionTitle note="ЧАСТЫЕ СПОРЫ">Спорные моменты</SectionTitle>
        <InkCard className="pl-list">
          {data.disputes.map(([q, a]) => (
            <div key={q} className="pl-dispute">
              <div className="pl-dispute-q">{q}</div>
              <p className="pl-text">{a}</p>
            </div>
          ))}
        </InkCard>
      </section>

      <PageFooter />
    </PageShell>
  );
}
