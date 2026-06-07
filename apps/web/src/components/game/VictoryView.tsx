// Финальный экран партии. Дизайн — Victory из редизайна (подиум + таблица).
// Используется и на /results/[gameId], и на /local/[id]/results.

import { ArrowLeft, Crown, RefreshCw, Trophy } from "lucide-react";
import type { GameFromAPI } from "@/types";
import { teamColorVar } from "@/constants/game";
import Avatar from "@/components/ui/Avatar";

interface VictoryViewProps {
  game: GameFromAPI;
  onHome: () => void;
  onRematch: () => void;
  rematchLabel?: string;
}

const HEIGHT_BY_PLACE: Record<number, string> = {
  1: "clamp(150px, 26vh, 220px)",
  2: "clamp(96px, 17vh, 150px)",
  3: "clamp(74px, 13vh, 116px)",
};

export function VictoryView({ game, onHome, onRematch, rematchLabel = "Реванш" }: VictoryViewProps) {
  const sorted = [...game.teams].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const winnerColor = teamColorVar(winner.order);

  // Подиум: 1-е место по центру, 2-е слева, 3-е справа (если есть).
  const top3 = sorted.slice(0, 3);
  const podium = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3.length === 2 ? [top3[1], top3[0]] : [top3[0]];
  const placeOf = (id: number) => sorted.findIndex((t) => t.id === id) + 1;

  return (
    <div className="victory-wrap">
      <div className="victory-head">
        <span className="eyebrow">партия завершена</span>
        <div className="victory-trophy" style={{ "--tc": `var(${winnerColor})` } as React.CSSProperties}>
          <Trophy size={48} />
        </div>
        <h1 className="h-mega victory-title" style={{ color: `var(${winnerColor})` }}>
          {winner.name}
        </h1>
        <p className="h-sub">
          Победа со счётом <b className="mono">{winner.score}</b> очков. Достойно!
        </p>
      </div>

      {podium.length > 1 && (
        <div className="podium">
          {podium.map((t) => {
            const place = placeOf(t.id);
            return (
              <div
                key={t.id}
                className={"podium-col p" + place}
                style={{ "--tc": `var(${teamColorVar(t.order)})` } as React.CSSProperties}
              >
                <div className="podium-team">
                  {place === 1 && <Crown size={26} className="podium-crown" />}
                  <Avatar name={t.name} color={teamColorVar(t.order)} size={44} />
                  <b>{t.name}</b>
                  <span className="podium-score mono">{t.score}</span>
                </div>
                <div className="podium-bar" style={{ height: HEIGHT_BY_PLACE[place] }}>
                  <span className="podium-place mono">{place}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="victory-table card">
        {sorted.map((t, i) => (
          <div key={t.id} className="vt-row" style={{ "--tc": `var(${teamColorVar(t.order)})` } as React.CSSProperties}>
            <span className="vt-rank mono">{i + 1}</span>
            <span className="vt-dot" />
            <span className="vt-name">{t.name}</span>
            <span className="vt-players muted">{t.players.map((p) => p.name).join(", ")}</span>
            <span className="vt-score mono">{t.score}</span>
          </div>
        ))}
      </div>

      <div className="victory-actions">
        <button type="button" className="btn btn-secondary btn-lg" onClick={onHome}>
          <ArrowLeft /> На главную
        </button>
        <button type="button" className="btn btn-primary btn-lg" onClick={onRematch}>
          <RefreshCw /> {rematchLabel}
        </button>
      </div>
    </div>
  );
}

export default VictoryView;
