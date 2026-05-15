"use client";

// Карточка одной игры в истории на главной. См. DESIGN.md §5.1.

import Link from "next/link";
import { ArrowRight, Crown, Trash2 } from "lucide-react";
import type { GameFromAPI } from "@/types";
import { teamColorVar } from "@/constants/game";
import { formatDateRu } from "@/lib/utils";
import Pill from "@/components/ui/Pill";
import Card from "@/components/ui/Card";

interface HistoryRowProps {
  game: GameFromAPI;
  onDelete: (id: string) => void;
  deleting?: boolean;
}

export function HistoryRow({ game, onDelete, deleting }: HistoryRowProps) {
  const winner =
    game.status === "FINISHED"
      ? game.teams.reduce((best, t) => (t.score > best.score ? t : best), game.teams[0])
      : null;

  const isLocal = game.mode === "LOCAL";
  const continueHref = isLocal ? `/local/${game.id}/turn` : `/room/${game.id}`;

  return (
    <Card className="flex flex-col gap-3">
      {/* Top row: status + date + actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {game.status === "IN_PROGRESS" ? (
            <Pill tone="live">LIVE</Pill>
          ) : (
            <Pill tone="success">DONE</Pill>
          )}
          <span
            className="font-mono text-[11px] px-2 py-0.5 rounded shrink-0"
            style={{ background: "var(--bg-3)", color: "var(--fg-2)" }}
          >
            {formatDateRu(game.createdAt)}
          </span>
          {!isLocal && <Pill mono>ONLINE</Pill>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {game.status === "IN_PROGRESS" && (
            <Link
              href={continueHref}
              className="h-8 px-3 inline-flex items-center justify-center gap-1 text-xs font-bold rounded-md"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
            >
              Продолжить <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          )}
          <button
            type="button"
            onClick={() => onDelete(game.id)}
            disabled={deleting}
            aria-label="Удалить игру"
            className="w-8 h-8 inline-flex items-center justify-center rounded-md disabled:opacity-50"
            style={{
              background: "var(--bg-2)",
              color: "var(--fg-3)",
              border: "1px solid var(--line)",
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Teams strip */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {game.teams.map((team) => {
          const isWinner = winner?.id === team.id;
          return (
            <li key={team.id} className="flex items-center gap-2 text-sm">
              <span
                className="w-2 h-2 rounded-sm shrink-0"
                style={{ background: `var(${teamColorVar(team.order)})` }}
              />
              <span
                className="font-medium truncate max-w-[120px]"
                style={{ color: isWinner ? "var(--accent)" : "var(--fg-1)" }}
              >
                {team.name}
              </span>
              <span
                className="font-mono text-xs tabular-nums"
                style={{ color: isWinner ? "var(--accent)" : "var(--fg-2)" }}
              >
                {team.score}
              </span>
              {isWinner && <Crown size={14} style={{ color: "var(--warn)" }} />}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default HistoryRow;
