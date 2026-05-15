"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Smartphone, Wifi } from "lucide-react";
import type { GameFromAPI } from "@/types";
import HistoryRow from "@/components/home/HistoryRow";
import Header from "@/components/ui/Header";

type Mode = "offline" | "online";

interface Stats {
  games: number;
  guessedWords: number;
  successRate: number;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("offline");
  const [games, setGames] = useState<GameFromAPI[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/games").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/stats").then((r) => (r.ok ? r.json() : { games: 0, guessedWords: 0, successRate: 0 })),
    ])
      .then(([g, s]) => {
        if (cancelled) return;
        setGames(g);
        setStats(s);
      })
      .catch(() => {
        if (cancelled) return;
        setGames([]);
        setStats({ games: 0, guessedWords: 0, successRate: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить игру? Это действие нельзя отменить.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/games/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setGames((prev) => prev?.filter((g) => g.id !== id) ?? prev);
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 md:px-8 py-12 md:py-16">
        {/* Hero */}
        <section className="mb-12 md:mb-16">
          <div className="eyebrow mb-4">PARTY GAME · 3+ PLAYERS</div>
          <h1 className="h-display md:text-6xl md:leading-[1.05]">
            Объясняй слова.<br />
            <span style={{ color: "var(--accent)" }}>Угадывай быстрее</span><br />
            всех остальных.
          </h1>
          <p className="mt-4 max-w-xl" style={{ color: "var(--fg-2)" }}>
            Классический Alias на одном устройстве или онлайн — каждый со
            своего телефона.
          </p>
        </section>

        {/* Mode toggle */}
        <section className="grid gap-4 md:grid-cols-2 mb-10">
          <ModeCard
            kind="offline"
            active={mode === "offline"}
            onClick={() => setMode("offline")}
            title="Локально"
            subtitle="Одно устройство на всех"
            features={[
              "Передаёте телефон по очереди",
              "Без интернета",
              "Быстрый старт",
            ]}
          />
          <ModeCard
            kind="online"
            active={mode === "online"}
            onClick={() => setMode("online")}
            title="Онлайн"
            subtitle="Каждый со своего устройства"
            features={[
              "Хост создаёт комнату",
              "Игроки заходят по коду",
              "Лобби работает, игровой цикл — скоро",
            ]}
          />
        </section>

        {/* CTA */}
        <section className="flex flex-col md:flex-row gap-3 mb-16">
          {mode === "online" ? (
            <>
              <Link
                href="/room/new"
                className="flex-1 md:flex-none inline-flex items-center justify-center px-6 h-12 rounded-xl font-bold transition"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-fg)",
                  boxShadow: "var(--glow)",
                }}
              >
                Создать комнату
              </Link>
              <Link
                href="/join"
                className="flex-1 md:flex-none inline-flex items-center justify-center px-6 h-12 rounded-xl font-semibold border transition"
                style={{
                  background: "var(--bg-2)",
                  color: "var(--fg)",
                  borderColor: "var(--line-strong)",
                }}
              >
                Войти по коду
              </Link>
            </>
          ) : (
            <Link
              href="/local/new"
              className="flex-1 md:flex-none inline-flex items-center justify-center px-6 h-12 rounded-xl font-bold transition"
              style={{
                background: "var(--accent)",
                color: "var(--accent-fg)",
                boxShadow: "var(--glow)",
              }}
            >
              Новая игра
            </Link>
          )}
        </section>

        {/* Stats strip */}
        {stats && stats.games > 0 && (
          <section className="grid grid-cols-3 gap-3 mb-10">
            <Stat value={stats.games} label="ИГР" />
            <Stat value={stats.guessedWords} label="СЛОВ УГАДАНО" />
            <Stat
              value={`${Math.round(stats.successRate * 100)}%`}
              label="УСПЕХ"
            />
          </section>
        )}

        {/* History */}
        <section>
          <div className="flex items-end justify-between mb-4">
            <h2 className="h-title">История игр</h2>
            {games && games.length > 0 && (
              <span className="eyebrow">{games.length} ЗАПИСЕЙ</span>
            )}
          </div>

          {games === null ? (
            <p className="text-sm" style={{ color: "var(--fg-2)" }}>Загрузка…</p>
          ) : games.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed p-8 text-center"
              style={{ borderColor: "var(--line-strong)", color: "var(--fg-2)" }}
            >
              Здесь появятся ваши недавние игры.
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {games.map((game) => (
                <li key={game.id}>
                  <HistoryRow
                    game={game}
                    onDelete={handleDelete}
                    deleting={deletingId === game.id}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div
      className="rounded-md p-3 md:p-4"
      style={{
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
      }}
    >
      <div className="text-2xl md:text-3xl font-extrabold tabular-nums">
        {value}
      </div>
      <div
        className="font-mono text-[10px] md:text-[11px] uppercase mt-1"
        style={{ letterSpacing: "0.1em", color: "var(--fg-2)" }}
      >
        {label}
      </div>
    </div>
  );
}

function ModeCard({
  kind,
  active,
  onClick,
  title,
  subtitle,
  features,
  comingSoon,
}: {
  kind: "online" | "offline";
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  features: string[];
  comingSoon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-2xl p-6 border transition relative overflow-hidden"
      style={{
        background: active
          ? "color-mix(in oklch, var(--accent) 12%, var(--bg-1))"
          : "var(--bg-1)",
        borderColor: active ? "var(--accent-line)" : "var(--line)",
        boxShadow: active ? "var(--glow)" : "var(--shadow-card)",
      }}
    >
      {active && (
        <div
          className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, oklch(0.78 0.16 165 / 0.35), transparent 70%)",
          }}
        />
      )}
      <div className="flex items-start gap-4">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: active ? "var(--accent-soft)" : "var(--bg-3)",
            color: active ? "var(--accent)" : "var(--fg-2)",
          }}
        >
          {kind === "online" ? <Wifi size={18} /> : <Smartphone size={18} />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-extrabold tracking-tight">{title}</h3>
            {active && (
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                Выбрано
              </span>
            )}
            {comingSoon && (
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{
                  background: "color-mix(in oklch, var(--warn) 18%, var(--bg-2))",
                  color: "var(--warn)",
                }}
              >
                Скоро
              </span>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--fg-2)" }}>
            {subtitle}
          </p>
        </div>
      </div>
      <ul className="mt-5 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm">
            <span
              className="inline-flex items-center justify-center w-4 h-4 rounded-full"
              style={{
                background: active ? "var(--accent)" : "var(--bg-3)",
                color: active ? "var(--accent-fg)" : "var(--fg-2)",
              }}
            >
              <Check size={10} strokeWidth={3} />
            </span>
            <span style={{ color: "var(--fg-1)" }}>{f}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

