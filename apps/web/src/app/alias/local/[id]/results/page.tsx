"use client";

// Финальный экран локальной игры. Дизайн — Victory (см. VictoryView).

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { GameFromAPI } from "@/types";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { prepareLocalRematch } from "@/lib/rematch";
import AppShell from "@/components/common/AppShell";
import VictoryView from "@/components/alias/game/VictoryView";

export default function LocalResultsPage() {
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

  return (
    <AppShell centered className="screen-anim">
      <VictoryView
        game={game}
        actions={
          <>
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => router.push("/alias")}>
              <ArrowLeft /> К Алиасу
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => {
                // Раньше «Новая игра» вела на пустой экран команд, и имена
                // приходилось вбивать заново.
                prepareLocalRematch(game);
                router.push("/alias/local/new");
              }}
            >
              <RefreshCw /> Ещё раз тем же составом
            </button>
          </>
        }
      />
    </AppShell>
  );
}
