"use client";

// Полноэкранный анонс (утро/итог голосования/последнее слово): большая иконка,
// надзаголовок, крупный заголовок, контент, футер.

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export default function Announce({
  icon: Icon,
  iconColor,
  glow,
  kicker,
  title,
  titleColor,
  children,
  footer,
}: {
  icon?: LucideIcon;
  iconColor?: string;
  glow?: string;
  kicker?: string;
  title: ReactNode;
  titleColor?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: "0 28px",
          textAlign: "center",
        }}
      >
        {Icon ? (
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--mf-border)",
              color: iconColor ?? "var(--mf-text-dim)",
              boxShadow: glow ?? "none",
            }}
          >
            <Icon size={44} strokeWidth={1.4} />
          </div>
        ) : null}
        {kicker ? (
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--mf-text-faint)" }}>{kicker}</div>
        ) : null}
        <div
          style={{
            fontWeight: 800,
            fontSize: 34,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            color: titleColor ?? "var(--mf-text)",
            textWrap: "balance",
          }}
        >
          {title}
        </div>
        {children}
      </div>
      {footer ? <div style={{ padding: "0 20px 24px" }}>{footer}</div> : null}
    </>
  );
}
