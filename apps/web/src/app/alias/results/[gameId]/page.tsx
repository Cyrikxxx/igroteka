"use client";

// Общий экран финального счёта — и для LOCAL, и для ONLINE (по Game.mode).
// Дизайн — Victory из редизайна (см. VictoryView).

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { GameFromAPI } from "@/types";
import AppShell from "@/components/common/AppShell";
import VictoryView from "@/components/alias/game/VictoryView";

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  const [game, setGame] = useState<GameFromAPI | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/games/${gameId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Не удалось загрузить игру");
        return r.json();
      })
      .then(setGame)
      .catch((e: Error) => setError(e.message));
  }, [gameId]);

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

  const isLocal = game.mode === "LOCAL";
  return (
    <AppShell centered className="screen-anim">
      <VictoryView
        game={game}
        onHome={() => router.push("/alias")}
        onRematch={() => router.push(isLocal ? "/alias/local/new" : "/alias/room/new")}
        rematchLabel={isLocal ? "Новая игра" : "Новая комната"}
      />
    </AppShell>
  );
}
