"use client";

// Карточка одной игры в истории. Дизайн — .hist-card из редизайна.

import Link from "next/link";
import { Check, Crown, Play, Smartphone, Trash2, Trophy, Wifi } from "lucide-react";
import type { GameFromAPI } from "@/types";
import { formatDateRu } from "@/lib/utils";

interface HistoryRowProps {
  game: GameFromAPI;
  onDelete: (id: string) => void;
  deleting?: boolean;
}

export function HistoryRow({ game, onDelete, deleting }: HistoryRowProps) {
  const live = game.status === "IN_PROGRESS";
  const isLocal = game.mode === "LOCAL";
  const sorted = [...game.teams].sort((a, b) => b.score - a.score);
  const winnerId = !live && sorted.length ? sorted[0].id : null;

  const continueHref = isLocal ? `/local/${game.id}/turn` : `/room/${game.roomId ?? game.id}`;
  const resultsHref = isLocal ? `/local/${game.id}/results` : `/results/${game.id}`;

  return (
    <div className={"hist-card" + (live ? " live" : "")}>
      <div className="hist-card-head">
        <div className="hist-meta">
          {live ? (
            <span className="pill pill-live">
              <span className="dot dot-pulse" /> LIVE
            </span>
          ) : (
            <span className="pill pill-mono">
              <Check size={13} /> завершена
            </span>
          )}
          <span className="pill pill-mono">
            {isLocal ? <Smartphone size={13} /> : <Wifi size={13} />}
            {isLocal ? "локально" : "онлайн"}
          </span>
        </div>
        <span className="hist-date mono">{formatDateRu(game.createdAt)}</span>
      </div>

      <div className="hist-teams">
        {sorted.map((t) => {
          const isWin = winnerId === t.id;
          return (
            <div
              key={t.id}
              className={"hist-team" + (isWin ? " win" : "")}
              style={{ "--tc": `var(${t.color})` } as React.CSSProperties}
            >
              <span className="ht-dot" />
              <span className="ht-name">{t.name}</span>
              {isWin && <Crown size={15} className="ht-crown" />}
              <span className="ht-score mono">{t.score}</span>
            </div>
          );
        })}
      </div>

      <div className="hist-foot">
        <span className="hist-round mono">{game.currentRoundNumber} раундов</span>
        <div className="hist-actions">
          {live ? (
            <Link href={continueHref} className="btn btn-primary btn-sm">
              <Play size={15} /> Продолжить
            </Link>
          ) : (
            <Link href={resultsHref} className="btn btn-secondary btn-sm">
              <Trophy size={15} /> Итоги
            </Link>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={() => onDelete(game.id)}
            disabled={deleting}
            aria-label="Удалить игру"
            title="Удалить"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default HistoryRow;
