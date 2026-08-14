// Общий каркас страниц платформы (О нас, Правила, История): шапка с
// навигацией, заголовок страницы, карточки и подвал.
// Порт project-context/mafia-design/platform/chrome.jsx.

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supportMailto } from "@/constants/site";

const NAV: [string, string][] = [
  ["О нас", "/about"],
  ["Правила", "/rules"],
  ["История", "/history"],
];

export function PlatformTopBar({ active }: { active?: string }) {
  return (
    <div className="pl-topbar">
      <Link href="/" className="pl-brand">
        <span className="pl-dot" style={{ background: "var(--alias-green)" }} />
        <span className="pl-dot" style={{ background: "var(--mf-crimson)" }} />
        <span>ИГРОТЕКА</span>
      </Link>

      <nav className="pl-nav">
        {NAV.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className={label === active ? "pl-nav-active" : undefined}
          >
            {label}
          </Link>
        ))}
        <a href={supportMailto()}>Поддержка</a>
      </nav>
    </div>
  );
}

export function PageHead({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="pl-head">
      <Link href="/" className="pl-back">
        <ArrowLeft size={16} /> На главную
      </Link>
      <div className="pl-head-text">
        <h1 className="pl-title">{title}</h1>
        <p className="pl-lead">{lead}</p>
      </div>
    </div>
  );
}

export function SectionTitle({
  children,
  note,
}: {
  children: ReactNode;
  note?: string;
}) {
  return (
    <div className="pl-section-title">
      <h2>{children}</h2>
      {note ? <span className="mf-mono pl-section-note">{note}</span> : null}
    </div>
  );
}

export function InkCard({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={"pl-card" + (className ? " " + className : "")} style={style}>
      {children}
    </div>
  );
}

export function PageFooter() {
  return (
    <div className="pl-footer">
      <span>Игротека · Алиас и Мафия</span>
      <div className="pl-footer-links">
        {NAV.map(([label, href]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
        <a href={supportMailto()}>Поддержка</a>
      </div>
    </div>
  );
}

export default function PageShell({
  active,
  children,
}: {
  active?: string;
  children: ReactNode;
}) {
  return (
    <div className="pl-screen">
      <PlatformTopBar active={active} />
      <div className="pl-body">{children}</div>
    </div>
  );
}
