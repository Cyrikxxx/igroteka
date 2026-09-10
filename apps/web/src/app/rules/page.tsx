"use client";

// Страница «Правила»: табы Алиас / Мафия — факты, порядок партии, роли,
// спорные моменты. Порт mafia-design/platform/screen-rules.jsx.
//
// Здесь описана игра, которая есть на самом деле, а не задумка из макета.
// Числа собираются из тех же констант, что и движок: правила, разъехавшиеся
// с игрой, хуже отсутствующих.

import { useState } from "react";
import {
  Sparkles,
  VenetianMask,
  MessageSquareText,
  Users2,
  ListChecks,
  Crown,
  Search,
  HeartPulse,
  Skull,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  MIN_TEAMS,
  MAX_TEAMS,
  MAX_PLAYERS_PER_TEAM,
  TRIO_TEAMS,
  ROUND_TIME_OPTIONS,
  WIN_SCORE_OPTIONS,
} from "@alias/shared/constants";
import {
  MIN_MAFIA_PLAYERS,
  MAX_MAFIA_PLAYERS,
  MAFIA_TIMER_LIMITS,
} from "@alias/shared/mafia";
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

// Меньше всего людей нужно втроём — там ровно три места. Больше всего
// набирается командами: шесть команд по шесть человек.
const ALIAS_MIN_PLAYERS = TRIO_TEAMS;
const ALIAS_MAX_PLAYERS = MAX_TEAMS * MAX_PLAYERS_PER_TEAM;

const ROUND_MIN = ROUND_TIME_OPTIONS[0];
const ROUND_MAX = ROUND_TIME_OPTIONS[ROUND_TIME_OPTIONS.length - 1];
const SCORE_MIN = WIN_SCORE_OPTIONS[0];
const SCORE_MAX = WIN_SCORE_OPTIONS[WIN_SCORE_OPTIONS.length - 1];

const ALIAS: RuleSet = {
  accent: "var(--alias-green)",
  lead: "Одна команда объясняет слова, другая угадывает. Побеждает команда, первой набравшая нужное число очков.",
  facts: [
    ["Игроков", `${ALIAS_MIN_PLAYERS}–${ALIAS_MAX_PLAYERS}`],
    ["Команд", `${MIN_TEAMS}–${MAX_TEAMS}`],
    ["Раунд", `${ROUND_MIN}–${ROUND_MAX} с`],
    ["Цель", `${SCORE_MIN}–${SCORE_MAX}`],
  ],
  steps: [
    [
      "Соберитесь командами или втроём",
      `Команд от ${MIN_TEAMS} до ${MAX_TEAMS}, в каждой от 2 до ${MAX_PLAYERS_PER_TEAM} человек. Втроём — отдельный режим: три места по одному игроку, и очки за раунд получают оба — кто объяснял и кто угадал.`,
    ],
    [
      "Выберите слова",
      "Восемь подборок, тридцать пять тем и три уровня сложности — всё это комбинируется. Счётчик показывает, сколько получилось уникальных слов: темы и уровни пересекаются, поэтому он меньше суммы.",
    ],
    [
      "Объясняйте на время",
      `Раунд от ${ROUND_MIN} до ${ROUND_MAX} секунд. Объясняющий говорит про слово что угодно, кроме однокоренных и перевода, команда называет варианты вслух.`,
    ],
    [
      "Сверьте итоги раунда",
      "Угаданное слово — плюс очко. Пропуск по умолчанию бесплатный, штраф за него включается в настройках. Спорные слова объясняющий правит прямо на экране итогов, счёт пересчитывается сразу.",
    ],
    [
      "Доведите до цели",
      `Цель — от ${SCORE_MIN} до ${SCORE_MAX} очков. Победа считается только в конце круга, поэтому последний ход есть у каждой команды.`,
    ],
  ],
  rolesTitle: "Кто что делает",
  roles: [
    [
      MessageSquareText,
      "Объясняющий",
      "var(--alias-green)",
      "Видит слово только на своём экране. Говорит про него всё, кроме однокоренных, перевода и первой буквы.",
    ],
    [
      Users2,
      "Команда",
      "#a3e635",
      "Называет варианты вслух — попыток сколько угодно, пока идёт таймер.",
    ],
    [
      ListChecks,
      "Итоги раунда",
      "var(--mf-text-dim)",
      "Список слов после сигнала: объясняющий снимает спорные и подтверждает счёт. Видно всем.",
    ],
  ],
  disputes: [
    [
      "Однокоренные слова",
      "Слово не засчитывается — снимите его на экране итогов. Отдельного штрафа сверх этого нет.",
    ],
    [
      "Слово угадали после сигнала",
      "Договоритесь заранее. Сайт считает такое слово пропущенным, но на итогах раунда его можно вернуть одним касанием.",
    ],
    [
      "Жесты и звуки",
      "Сайт за этим не следит. По классическим правилам нельзя — решайте до начала партии.",
    ],
    [
      "Пропуск слова",
      "По умолчанию бесплатный, и число пропусков не ограничено. В настройках включается штраф — тогда пропуск стоит очко.",
    ],
    [
      "Ничья по очкам",
      "Круг доигрывается полностью, поэтому цель могут взять сразу две команды. Победит та, у кого больше очков; при точном равенстве — та, что ходила раньше.",
    ],
  ],
};

const NIGHT_MIN = MAFIA_TIMER_LIMITS.night.min;
const NIGHT_MAX = MAFIA_TIMER_LIMITS.night.max;
const TALK_MIN = MAFIA_TIMER_LIMITS.discussion.min;
const TALK_MAX_MIN = MAFIA_TIMER_LIMITS.discussion.max / 60;

const MAFIA: RuleSet = {
  accent: "var(--mf-crimson)",
  lead: "Город спит — мафия убивает. Днём город обсуждает и голосует. Побеждает сторона, оставшаяся в большинстве.",
  facts: [
    ["Игроков", `${MIN_MAFIA_PLAYERS}–${MAX_MAFIA_PLAYERS}`],
    ["Мафии", "1 на 3"],
    ["Ночь", `${NIGHT_MIN}–${NIGHT_MAX} с`],
    ["Обсуждение", `${TALK_MIN} с – ${TALK_MAX_MIN} мин`],
  ],
  steps: [
    [
      "Получите роли",
      "Сайт раздаёт их сам: роль приходит на телефон и видна только владельцу. Отдельный человек-ведущий не нужен — играют все.",
    ],
    [
      "Включите режим ведущего",
      "По желанию. Тогда ночь идёт по шагам, и сайт вслух зовёт роли по очереди — так можно играть за одним столом, не открывая глаз.",
    ],
    [
      "Ночь",
      "Мафия выбирает жертву, доктор лечит, шериф проверяет одного игрока, маньяк убивает сам за себя. Каждый ход — вслепую, на своём экране.",
    ],
    [
      "Утро",
      "Город узнаёт, кто выбыл. Роль выбывшего показывается по настройке партии. Первый день по умолчанию проходит без голосования.",
    ],
    [
      "Обсуждение и голосование",
      "Спорьте голосом, потом выбирайте, кого изгнать. У изгнанного есть последнее слово. Партия идёт, пока не победит одна из сторон.",
    ],
  ],
  rolesTitle: "Роли",
  roles: [
    [
      VenetianMask,
      "Мафия",
      "var(--role-mafia)",
      "Ночью выбирает жертву вместе с напарниками, днём притворяется мирной. Автоматически — примерно один на трёх игроков.",
    ],
    [
      Crown,
      "Дон",
      "var(--role-don)",
      "Появляется, когда мафий двое и больше, и по умолчанию выключен. Ночью решает большинство голосов мафии, а Дон разбивает ничью. Настройкой его можно скрыть от шерифа.",
    ],
    [
      Search,
      "Шериф",
      "var(--role-sheriff)",
      "Одна проверка за ночь: мафия или нет. Результаты копятся до конца партии.",
    ],
    [
      HeartPulse,
      "Доктор",
      "var(--role-doctor)",
      "Лечит одного за ночь. Дважды подряд одного и того же нельзя, себя — один раз за партию.",
    ],
    [
      Skull,
      "Маньяк",
      "var(--role-maniac)",
      "Играет сам за себя и убивает по ночам. Включается в настройках, по умолчанию его нет.",
    ],
    [
      User,
      "Мирный житель",
      "var(--role-civilian)",
      "Ночью ничего не умеет — всё решает голосом днём.",
    ],
  ],
  disputes: [
    ["Мафия убивает своего", "Нельзя: сайт не даст выбрать целью мафию или дона."],
    [
      "Равное число голосов",
      "Сразу второй тур — голосуют только за тех, кто набрал поровну. Если равенство повторилось, никто не выбывает и наступает ночь.",
    ],
    [
      "Доктор вылечил жертву",
      "Ночь проходит без выбывших, и город не узнаёт, кого спасали.",
    ],
    [
      "Выбывший подсказывает",
      "Чата в игре нет: выбывший смотрит партию зрителем и видит роли, если это не выключено в настройках. Подсказывать вслух — нарушение, но следит за этим компания, а не сайт.",
    ],
    [
      "На устройстве нет русского голоса",
      "Настройки скажут об этом прямо. Ночь всё равно идёт по шагам — просто молча.",
    ],
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
