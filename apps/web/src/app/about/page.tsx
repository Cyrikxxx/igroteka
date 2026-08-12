// Страница «О нас»: зачем сделано, как работает, кто делает, планы,
// контакты и данные. Порт mafia-design/platform/screen-about.jsx.

import {
  Smartphone,
  Wifi,
  History,
  User,
  Check,
  Loader,
  Circle,
  Send,
  Mail,
  Bug,
  Heart,
  UserX,
  HardDrive,
  EyeOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PageShell, {
  PageHead,
  SectionTitle,
  InkCard,
  PageFooter,
} from "@/components/platform/PageShell";

export const metadata = {
  title: "О проекте · Игротека",
  description: "Зачем сделана Игротека, как она работает и что будет дальше.",
};

const HOW: [LucideIcon, string, string][] = [
  [Smartphone, "Один телефон", "Локальная партия: телефон передаётся по кругу, интернет не нужен."],
  [Wifi, "Комната по коду", "Онлайн-партия: создаёшь комнату, друзья заходят по шестизначному коду."],
  [History, "История партий", "Незавершённая игра сохраняется — можно вернуться и доиграть позже."],
];

type RoadmapState = "done" | "now" | "next";
const ROADMAP: [RoadmapState, string, string, string][] = [
  ["done", "Алиас", "Локальные и онлайн-партии, наборы слов", "var(--alias-green)"],
  ["done", "Мафия", "Онлайн-партии с ведущим и без", "var(--mf-crimson)"],
  ["now", "Общая история игр", "Архив партий обеих игр в одном списке", "var(--mf-gold)"],
  ["next", "Новые игры", "Игротека пополняется — следующая игра в работе", "var(--role-civilian)"],
  ["next", "Профили и статистика", "Личный счёт побед и любимые наборы", "var(--role-civilian)"],
];

const MARKS: Record<RoadmapState, [LucideIcon, string]> = {
  done: [Check, "Готово"],
  now: [Loader, "В работе"],
  next: [Circle, "В планах"],
};

const CONTACTS: [LucideIcon, string, string, string][] = [
  [Send, "Телеграм", "Скоро", "Канал с обновлениями и чат для вопросов"],
  [Mail, "Почта", "Скоро", "Для длинных писем: баги, идеи, сотрудничество"],
  [Bug, "Сообщить о баге", "Форма в разработке", "Что случилось, на каком экране, какая игра"],
  [Heart, "Поддержать донатом", "Скоро", "По желанию — на доступ к играм не влияет"],
];

const DATA: [LucideIcon, string, string][] = [
  [UserX, "Без регистрации", "Аккаунт не нужен — достаточно имени в комнате."],
  [HardDrive, "История на устройстве", "Локальные партии хранятся в браузере и удаляются в один клик."],
  [EyeOff, "Без рекламы и трекеров", "Проект ничего не продаёт и не собирает лишних данных."],
];

export default function AboutPage() {
  return (
    <PageShell active="О нас">
      <PageHead
        title="О проекте"
        lead="Игротека — площадка для игр в компании: Алиас и Мафия работают в браузере, без установки и регистрации. Дальше игр станет больше."
      />

      {/* Зачем сделано */}
      <div className="pl-intro">
        <InkCard style={{ gap: 14 }}>
          <SectionTitle>Зачем это сделано</SectionTitle>
          <p className="pl-text">
            Настольные игры для компании обычно живут в трёх разных приложениях: одно
            для слов, другое для ролей, третье просто с таймером. Игротека собирает их
            в одном месте — с общим входом по коду, общей историей партий и одинаковыми
            правилами интерфейса.
          </p>
          <p className="pl-text">
            Ничего не нужно устанавливать и регистрировать: открыл ссылку, назвал имя,
            начал играть.
          </p>
        </InkCard>

        <InkCard style={{ gap: 12, justifyContent: "center" }}>
          <div className="pl-chips">
            <span className="mf-chip" style={{ color: "var(--alias-green)", fontSize: 13 }}>
              Бесплатно
            </span>
            <span className="mf-chip" style={{ fontSize: 13 }}>Без рекламы</span>
            <span className="mf-chip" style={{ fontSize: 13 }}>Без аккаунта</span>
          </div>
          <div className="pl-claim">
            Игры бесплатны целиком — платных наборов и подписки нет
          </div>
          <p className="pl-text pl-text-faint">
            Поддержать проект можно донатом, но это по желанию: на доступные функции он
            не влияет.
          </p>
        </InkCard>
      </div>

      {/* Как это работает */}
      <section className="pl-section">
        <SectionTitle note="ТРИ СПОСОБА СЫГРАТЬ">Как это работает</SectionTitle>
        <div className="pl-grid-3">
          {HOW.map(([Icon, title, text], i) => (
            <InkCard key={title} style={{ gap: 9 }}>
              <div className="pl-card-head">
                <Icon size={20} color="var(--mf-text-dim)" />
                <span className="mf-mono pl-num">0{i + 1}</span>
              </div>
              <div className="pl-card-title">{title}</div>
              <p className="pl-text">{text}</p>
            </InkCard>
          ))}
        </div>
      </section>

      {/* Кто делает */}
      <section className="pl-section">
        <SectionTitle>Кто делает</SectionTitle>
        <InkCard className="pl-team">
          <span className="pl-avatar">
            <User size={28} strokeWidth={1.6} />
          </span>
          <div className="pl-team-text">
            <div className="pl-card-title" style={{ fontSize: 18 }}>
              Проект делает один человек
            </div>
            <p className="pl-text">
              Дизайн, код, наборы слов и поддержка — всё в одних руках. Поэтому
              обновления выходят небольшими шагами, зато каждое письмо о баге или
              пожелании читает автор проекта.
            </p>
          </div>
        </InkCard>
      </section>

      {/* Что дальше */}
      <section className="pl-section">
        <SectionTitle note="БЕЗ ТОЧНЫХ ДАТ">Что дальше</SectionTitle>
        <InkCard className="pl-roadmap">
          {ROADMAP.map(([state, title, text, color]) => {
            const [Icon, label] = MARKS[state];
            return (
              <div key={title} className="pl-roadmap-row">
                <span
                  className="pl-roadmap-state"
                  style={{ color: state === "next" ? "var(--mf-text-faint)" : color }}
                >
                  <Icon size={15} /> {label}
                </span>
                <span
                  className="pl-roadmap-title"
                  style={{ color: state === "next" ? "var(--mf-text-dim)" : "var(--mf-text)" }}
                >
                  {title}
                </span>
                <span className="pl-roadmap-text">{text}</span>
              </div>
            );
          })}
        </InkCard>
      </section>

      {/* Связаться */}
      <section className="pl-section">
        <SectionTitle note="ССЫЛКИ ПОЯВЯТСЯ ПОЗЖЕ">Связаться</SectionTitle>
        <div className="pl-grid-2">
          {CONTACTS.map(([Icon, title, badge, text]) => (
            <InkCard key={title} style={{ gap: 8 }}>
              <div className="pl-contact-head">
                <span className="pl-contact-name">
                  <Icon size={18} color="var(--mf-text-dim)" /> {title}
                </span>
                <span className="mf-mono pl-badge">{badge}</span>
              </div>
              <p className="pl-text">{text}</p>
            </InkCard>
          ))}
        </div>
      </section>

      {/* Данные */}
      <section className="pl-section">
        <SectionTitle>Данные и приватность</SectionTitle>
        <div className="pl-grid-3">
          {DATA.map(([Icon, title, text]) => (
            <InkCard key={title} style={{ gap: 8 }}>
              <Icon size={20} color="var(--mf-text-dim)" />
              <div className="pl-card-title">{title}</div>
              <p className="pl-text">{text}</p>
            </InkCard>
          ))}
        </div>
      </section>

      <PageFooter />
    </PageShell>
  );
}
