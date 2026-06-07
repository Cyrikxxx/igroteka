import Link from "next/link";
import {
  ArrowRight,
  Check,
  Hash,
  SkipForward,
  Smartphone,
  Sparkles,
  Users,
  Wifi,
  Zap,
} from "lucide-react";
import AppShell from "@/components/ui/AppShell";
import RoomCode from "@/components/ui/RoomCode";

// CTA главного экрана. href — реальные маршруты приложения.
const CTAS = [
  {
    href: "/room/new",
    icon: Wifi,
    title: "Создать онлайн-комнату",
    sub: "/room/new",
    desc: "Каждый со своего телефона, в реальном времени",
    primary: true,
  },
  {
    href: "/local/new",
    icon: Smartphone,
    title: "На одном устройстве",
    sub: "/local/new",
    desc: "Одна компания, один телефон по кругу",
    primary: false,
  },
  {
    href: "/join",
    icon: Hash,
    title: "Войти по коду",
    sub: "/join",
    desc: "Есть код комнаты от друга? Заходи",
    primary: false,
  },
];

const FEATS = [
  { icon: Zap, t: "Без регистрации" },
  { icon: Sparkles, t: "10 категорий · 629 слов" },
  { icon: Smartphone, t: "Работает на любом телефоне" },
];

export default function Home() {
  return (
    <AppShell nav className="screen-anim">
      <div className="home-grid">
        {/* Левая колонка — текст + CTA */}
        <div className="home-copy">
          <div className="home-badges">
            <span className="pill pill-mono pill-accent">
              <Sparkles /> v2 · online party
            </span>
            <span className="pill pill-mono">
              <Users /> 5–32 игрока
            </span>
          </div>

          <h1 className="h-mega home-title">
            <span className="outline-text">АЛИАС</span>
            <br />
            <span>В РЕАЛЬНОМ</span>
            <br />
            <span className="accent-text">ВРЕМЕНИ</span>
          </h1>

          <p className="h-sub home-lead">
            Объясняй слово, не называя его. Собери друзей в одну комнату — каждый
            играет со своего телефона, счёт обновляется на лету.
          </p>

          <div className="home-ctas">
            {CTAS.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className={"home-cta" + (c.primary ? " home-cta--primary" : "")}
              >
                <span className="home-cta-ic">
                  <c.icon size={24} />
                </span>
                <span className="home-cta-body">
                  <span className="home-cta-title">{c.title}</span>
                  <span className="home-cta-desc">{c.desc}</span>
                </span>
                <span className="home-cta-sub mono">{c.sub}</span>
                <span className="home-cta-arrow">
                  <ArrowRight size={20} />
                </span>
              </Link>
            ))}
          </div>

          <div className="home-feats">
            {FEATS.map((f) => (
              <span className="feat" key={f.t}>
                <span className="fi">
                  <f.icon />
                </span>
                {f.t}
              </span>
            ))}
          </div>
        </div>

        {/* Правая колонка — декоративная сцена (скрыта ≤980px) */}
        <div className="home-stage" aria-hidden="true">
          <div className="hs-glow" />

          <div className="hs-card hs-card--word">
            <span className="eyebrow">слово · кино</span>
            <strong>Титаник</strong>
            <div className="hs-timer">
              <span className="mono">0:42</span>
              <div className="hs-track">
                <span style={{ width: "62%" }} />
              </div>
            </div>
          </div>

          <div className="hs-card hs-card--mini hs-card--got">
            <Check size={18} /> угадано <b>+1</b>
          </div>
          <div className="hs-card hs-card--mini hs-card--skip">
            <SkipForward size={18} /> пропуск
          </div>

          <div className="hs-card hs-card--score">
            <div className="hs-team" style={{ "--tc": "var(--team-1)" } as React.CSSProperties}>
              <span className="hs-dot" /> Мятные <b className="mono">14</b>
            </div>
            <div className="hs-team" style={{ "--tc": "var(--team-3)" } as React.CSSProperties}>
              <span className="hs-dot" /> Лиловые <b className="mono">11</b>
            </div>
            <div className="hs-team" style={{ "--tc": "var(--team-2)" } as React.CSSProperties}>
              <span className="hs-dot" /> Янтарные <b className="mono">9</b>
            </div>
          </div>

          <div className="hs-card hs-card--code">
            <span className="eyebrow">код комнаты</span>
            <RoomCode code="VPYZQQ" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
