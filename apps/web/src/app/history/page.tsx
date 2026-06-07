"use client";

// История игр. Реальные данные: GET /api/stats (агрегаты) + GET /api/games
// (локальные партии устройства). Удаление — DELETE /api/games/[id].
// Онлайн-партии пока не персистятся в списке — показываем локальные.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Dice5, Play } from "lucide-react";
import type { GameFromAPI } from "@/types";
import AppShell from "@/components/ui/AppShell";
import HistoryRow from "@/components/home/HistoryRow";

interface Stats {
  games: number;
  guessedWords: number;
  successRate: number;
}

export default function HistoryPage() {
  const [games, setGames] = useState<GameFromAPI[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/games")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: GameFromAPI[]) => setGames(data))
      .catch(() => setGames([]));
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Stats | null) => setStats(data))
      .catch(() => setStats(null));
  }, []);

  const onDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/games/${id}`, { method: "DELETE" });
      if (res.ok) setGames((g) => (g ?? []).filter((x) => x.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const rate = stats ? Math.round(stats.successRate * 100) : 0;
  const list = games ?? [];

  return (
    <AppShell className="screen-anim" nav>
      <Link href="/" className="back-link">
        <ArrowLeft /> На главную
      </Link>

      <div className="setup-head">
        <div>
          <span className="eyebrow">архив · твои партии</span>
          <h1 className="h-display" style={{ marginTop: 10 }}>
            История игр
          </h1>
          <p className="h-sub" style={{ marginTop: 8 }}>
            Сыгранные локальные партии и статистика — можно вернуться к
            незавершённой игре и доиграть.
          </p>
        </div>
      </div>

      <div className="hist-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <div className="stat">
          <span className="v mono">{stats ? stats.games : "—"}</span>
          <span className="l">сыграно игр</span>
        </div>
        <div className="stat">
          <span className="v mono accent-text">
            {stats ? stats.guessedWords.toLocaleString("ru") : "—"}
          </span>
          <span className="l">угадано слов</span>
        </div>
        <div className="stat">
          <span className="v mono">{stats ? `${rate}%` : "—"}</span>
          <span className="l">успешных объяснений</span>
        </div>
      </div>

      {games === null ? (
        <p className="muted" style={{ padding: "24px 0" }}>
          Загрузка…
        </p>
      ) : list.length ? (
        <div className="hist-list">
          {list.map((g) => (
            <HistoryRow key={g.id} game={g} onDelete={onDelete} deleting={deletingId === g.id} />
          ))}
        </div>
      ) : (
        <div className="hist-empty card">
          <span className="he-ic">
            <Dice5 size={32} />
          </span>
          <h2 className="h-title">Здесь пока пусто</h2>
          <p className="h-sub">
            Сыграй первую партию — она появится в истории, и можно будет к ней
            вернуться.
          </p>
          <Link href="/" className="btn btn-primary btn-lg" style={{ marginTop: 8 }}>
            <Play /> Начать игру
          </Link>
        </div>
      )}
    </AppShell>
  );
}
