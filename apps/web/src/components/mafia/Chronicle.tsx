"use client";

// Журнал партии в человеческом виде: лента для зрителя и «хроника» в финале.
// Одни и те же события, разная подача.

import { Moon, Sun, Vote, Trophy, HeartPulse, Search, Skull, Scale, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MafiaEvent } from "@alias/shared/mafia";

interface Line {
  icon: LucideIcon;
  color?: string;
  text: string;
}

/** Одна запись журнала → строка, которую можно прочитать вслух. */
function describe(e: MafiaEvent): Line | null {
  switch (e.kind) {
    case "night_fell":
      return { icon: Moon, text: `Ночь ${e.day} — город засыпает` };
    case "kill":
      return {
        icon: Skull,
        color: "var(--mf-crimson)",
        text:
          e.cause === "maniac"
            ? `Маньяк убил ${e.displayName}`
            : `Мафия убила ${e.displayName}`,
      };
    case "save":
      return {
        icon: HeartPulse,
        color: "var(--role-doctor)",
        text: e.displayName ? `Доктор спас ${e.displayName}` : "Доктор успел вовремя",
      };
    case "check":
      return {
        icon: Search,
        color: "var(--role-sheriff)",
        text: `Шериф проверил ${e.displayName} — ${e.isMafia ? "мафия" : "не мафия"}`,
      };
    case "no_deaths":
      return { icon: Sun, color: "var(--mf-gold)", text: "Все пережили эту ночь" };
    case "exile":
      return {
        icon: Vote,
        color: "var(--mf-crimson)",
        text: `Город изгнал ${e.displayName}`,
      };
    case "vote_tie":
      return { icon: Scale, text: "Голоса разделились — никто не выбыл" };
    case "vote_skip":
      return { icon: Scale, text: "Город решил никого не изгонять" };
    case "left":
      return { icon: LogOut, text: `${e.displayName} вышел из игры` };
    case "game_over":
      return {
        icon: Trophy,
        color: "var(--mf-gold)",
        text:
          e.winner === "mafia"
            ? "Мафия захватила город"
            : e.winner === "maniac"
              ? "Маньяк остался один"
              : "Город победил",
      };
    default:
      return null;
  }
}

/** Живая лента «что происходит» — экран зрителя. */
export function EventFeed({ events, limit = 6 }: { events: MafiaEvent[]; limit?: number }) {
  const lines = events.map(describe).filter(Boolean).slice(-limit).reverse() as Line[];
  if (lines.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {lines.map((l, i) => {
        const Icon = l.icon;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              background: "var(--mf-surface)",
              border: "1px solid var(--mf-border)",
              borderRadius: 13,
              padding: "10px 13px",
            }}
          >
            <Icon size={17} color={l.color ?? "var(--mf-text-faint)"} style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--mf-text-dim)" }}>{l.text}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Хроника партии сверху вниз — финальный экран. */
export function Chronicle({ events }: { events: MafiaEvent[] }) {
  const lines = events
    .map((e) => ({ e, line: describe(e) }))
    .filter((x): x is { e: MafiaEvent; line: Line } => x.line !== null);
  if (lines.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {lines.map(({ e, line }, i) => {
        const Icon = line.icon;
        const last = i === lines.length - 1;
        return (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--mf-surface-2)",
                  border: "1px solid var(--mf-border)",
                  color: line.color ?? "var(--mf-text-faint)",
                  flexShrink: 0,
                }}
              >
                <Icon size={14} />
              </div>
              {!last ? <div style={{ width: 1, flex: 1, background: "var(--mf-border)", minHeight: 12 }} /> : null}
            </div>
            <div style={{ paddingBottom: 14 }}>
              <div className="mf-mono" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--mf-text-faint)" }}>
                {e.kind === "exile" || e.kind === "vote_tie" || e.kind === "vote_skip"
                  ? `День ${e.day}`
                  : `Ночь ${e.day}`}
              </div>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--mf-text-dim)", marginTop: 1, lineHeight: 1.4 }}>
                {line.text}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
