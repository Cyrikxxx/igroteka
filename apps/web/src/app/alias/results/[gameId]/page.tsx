"use client";

// Общий экран финального счёта — и для LOCAL, и для ONLINE (по Game.mode).
// Дизайн — Victory из редизайна (см. VictoryView).

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { GameFromAPI } from "@/types";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { prepareLocalRematch, createRoomLike } from "@/lib/rematch";
import AppShell from "@/components/common/AppShell";
import VictoryView from "@/components/alias/game/VictoryView";

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  const [game, setGame] = useState<GameFromAPI | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
  // Партия уже в архиве, поэтому «ещё раз» здесь означает собрать такую же
  // новую: локальную — с теми же командами, онлайн — новой комнатой с теми
  // же правилами.
  const again = async () => {
    setBusy(true);
    try {
      if (isLocal) {
        prepareLocalRematch(game);
        router.push("/alias/local/new");
      } else {
        const code = await createRoomLike(game);
        router.push(`/alias/room/${code}`);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <AppShell centered className="screen-anim">
      <VictoryView
        game={game}
        actions={
          <>
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => router.push("/alias")}>
              <ArrowLeft /> К Алиасу
            </button>
            <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={again}>
              <RefreshCw /> {busy ? "Собираем…" : "Сыграть так же"}
            </button>
          </>
        }
      />
    </AppShell>
  );
}
