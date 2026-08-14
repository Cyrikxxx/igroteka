// Строка истории партии Мафии (на экране /history).

import { VenetianMask, Shield, Skull } from "lucide-react";

export interface MafiaHistoryGame {
  id: string;
  winner: "CITY" | "MAFIA" | "MANIAC" | null;
  dayCount: number;
  endedAt: string | null;
  createdAt: string;
  players: { name: string; role: string; alive: boolean }[];
}

const WIN = {
  CITY: { label: "Город", color: "var(--alias-green)", Icon: Shield },
  MAFIA: { label: "Мафия", color: "var(--mf-crimson)", Icon: VenetianMask },
  MANIAC: { label: "Маньяк", color: "var(--role-maniac)", Icon: Skull },
} as const;

export default function MafiaHistoryRow({ game }: { game: MafiaHistoryGame }) {
  const w = game.winner ? WIN[game.winner] : null;
  const Icon = w?.Icon ?? Shield;
  const date = new Date(game.endedAt ?? game.createdAt).toLocaleDateString("ru", {
    day: "numeric",
    month: "short",
  });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-md)",
        padding: "14px 16px",
      }}
    >
      <span
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "color-mix(in srgb, var(--bg-3) 70%, transparent)",
          color: w?.color ?? "var(--fg-2)",
          flexShrink: 0,
        }}
      >
        <Icon size={20} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>
          Мафия · победа: <span style={{ color: w?.color }}>{w?.label ?? "—"}</span>
        </div>
        <div className="mono" style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 2 }}>
          {game.players.length} игроков · {game.dayCount} дн.
        </div>
      </div>
      <time style={{ fontSize: 12.5, color: "var(--fg-3)", whiteSpace: "nowrap" }}>{date}</time>
    </div>
  );
}
