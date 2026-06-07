"use client";

// Передача устройства перед раундом. Дизайн — PassScreen из редизайна.

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Crown, EyeOff, Play } from "lucide-react";
import type { GameFromAPI } from "@/types";
import { teamColorVar } from "@/constants/game";
import AppShell from "@/components/ui/AppShell";
import Avatar from "@/components/ui/Avatar";

export default function LocalTurnPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;
  const [game, setGame] = useState<GameFromAPI | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/games/${gameId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Не удалось загрузить игру");
        return r.json();
      })
      .then((g: GameFromAPI) => {
        if (g.status === "FINISHED") {
          router.replace(`/local/${gameId}/results`);
          return;
        }
        setGame(g);
      })
      .catch((e: Error) => setError(e.message));
  }, [gameId, router]);

  if (error) {
    return (
      <AppShell centered>
        <p style={{ color: "var(--danger)", textAlign: "center" }}>{error}</p>
      </AppShell>
    );
  }
  if (!game) {
    return (
      <AppShell centered>
        <p className="muted" style={{ textAlign: "center" }}>
          Загрузка…
        </p>
      </AppShell>
    );
  }

  const team = game.teams.find((t) => t.order === game.currentTeamIndex)!;
  const player = team.players[team.currentPlayerIndex];
  const colorVar = teamColorVar(team.order);
  const sorted = [...game.teams].sort((a, b) => b.score - a.score);

  return (
    <AppShell centered className="screen-anim">
      <div className="pass-wrap" style={{ "--tc": `var(${colorVar})` } as React.CSSProperties}>
        <div className="pass-hero">
          <span className="eyebrow">передай устройство · раунд {game.currentRoundNumber}</span>
          <div className="pass-avatar">
            <Avatar name={player.name} color={colorVar} size={92} />
          </div>
          <h1 className="pass-name">{player.name}</h1>
          <p className="pass-team">объясняет за команду «{team.name}»</p>
          <div className="pass-players">
            {team.players.map((p) => (
              <span className="pass-chip mono" key={p.id}>
                {p.name}
              </span>
            ))}
          </div>
        </div>

        <div className="pass-side">
          <div className="card pass-score">
            <span className="eyebrow">текущий счёт</span>
            <div className="pass-score-list">
              {sorted.map((t, i) => (
                <div
                  className={"pass-score-row" + (i === 0 ? " lead" : "")}
                  key={t.id}
                  style={{ "--tc": `var(${teamColorVar(t.order)})` } as React.CSSProperties}
                >
                  <span className="psr-rank mono">{i + 1}</span>
                  <span className="psr-dot" />
                  <span className="psr-name">{t.name}</span>
                  {i === 0 && <Crown size={15} className="psr-crown" />}
                  <span className="psr-score mono">{t.score}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            onClick={() => router.push(`/local/${gameId}/round`)}
          >
            <Play /> Я готов · начать раунд
          </button>
          <p className="pass-note mono">
            <EyeOff size={14} /> Слово увидишь только ты
          </p>
        </div>
      </div>
    </AppShell>
  );
}
