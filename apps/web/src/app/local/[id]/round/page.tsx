"use client";

// Локальная игра — раунд: таймер, WordCard, угадал/пропустил, RoundSummary.
// См. DESIGN.md §5.6 (game) и §5.7 (round summary), CURRENT_CODE.md §3.1.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Check, Pause, X } from "lucide-react";
import type { GameFromAPI, WordInRound } from "@/types";
import { useTimer } from "@/hooks/useTimer";
import { teamColorVar } from "@/constants/game";
import { formatTime } from "@/lib/utils";
import Header from "@/components/ui/Header";
import Pill from "@/components/ui/Pill";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

type Phase = "loading" | "active" | "summary" | "saving";

export default function LocalRoundPage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;

  const [game, setGame] = useState<GameFromAPI | null>(null);
  const [words, setWords] = useState<WordInRound[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pauseOpen, setPauseOpen] = useState(false);

  const wordsRef = useRef(words);
  wordsRef.current = words;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const fetchedRef = useRef(false);

  const handleTimeUp = useCallback(() => {
    // Если в момент истечения таймера слово ещё открыто — фиксируем как пропуск.
    setWords((prev) => {
      const idx = currentIndexRef.current;
      if (idx >= prev.length || prev[idx].guessed !== null) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], guessed: false };
      return next;
    });
    setPhase("summary");
  }, []);

  const { timeLeft, start, pause, isRunning } = useTimer({
    initialTime: game?.roundTime ?? 60,
    onTimeUp: handleTimeUp,
  });

  // Загрузка
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      try {
        const [gameRes, wordsRes] = await Promise.all([
          fetch(`/api/games/${gameId}`),
          fetch(`/api/games/${gameId}/words`),
        ]);
        if (!gameRes.ok) throw new Error("Игра не найдена");
        if (!wordsRes.ok) throw new Error("Не удалось загрузить слова");
        const g = (await gameRes.json()) as GameFromAPI;
        const ws = (await wordsRes.json()) as { id: number; text: string }[];
        if (g.status === "FINISHED") {
          router.replace(`/local/${gameId}/results`);
          return;
        }
        if (ws.length === 0) {
          setError("Слова в выбранных категориях закончились.");
          setPhase("summary");
          return;
        }
        setGame(g);
        setWords(
          ws.map((w, i) => ({ wordId: w.id, text: w.text, guessed: null, order: i })),
        );
        setPhase("active");
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [gameId, router]);

  // Стартуем таймер, как только всё загружено
  useEffect(() => {
    if (phase === "active" && game && !isRunning && timeLeft === game.roundTime) {
      start();
    }
  }, [phase, game, isRunning, timeLeft, start]);

  const guess = (guessed: boolean) => {
    setWords((prev) => {
      const next = [...prev];
      const idx = currentIndexRef.current;
      if (idx >= next.length) return prev;
      next[idx] = { ...next[idx], guessed };
      return next;
    });
    setCurrentIndex((i) => {
      const nextIdx = i + 1;
      // Если слова закончились — досрочно завершаем раунд.
      if (nextIdx >= wordsRef.current.length) {
        setPhase("summary");
        pause();
      }
      return nextIdx;
    });
  };

  const toggleSummaryWord = (wordId: number) => {
    setWords((prev) =>
      prev.map((w) => (w.wordId === wordId ? { ...w, guessed: !w.guessed } : w)),
    );
  };

  const confirm = async () => {
    if (!game) return;
    setPhase("saving");
    const team = game.teams.find((t) => t.order === game.currentTeamIndex)!;
    const player = team.players[team.currentPlayerIndex];
    const answered = wordsRef.current.filter((w) => w.guessed !== null);
    try {
      const res = await fetch(`/api/games/${gameId}/rounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          playerName: player.name,
          words: answered.map((w) => ({
            wordId: w.wordId,
            guessed: w.guessed,
            order: w.order,
          })),
        }),
      });
      if (!res.ok) throw new Error("Не удалось сохранить раунд");
      const result = (await res.json()) as { gameFinished: boolean };
      if (result.gameFinished) {
        router.replace(`/local/${gameId}/results`);
      } else {
        router.replace(`/local/${gameId}/turn`);
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase("summary");
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md text-center">
            <p style={{ color: "var(--danger)" }} className="mb-4">{error}</p>
            <Button onClick={() => router.replace(`/local/${gameId}/turn`)}>Назад</Button>
          </Card>
        </main>
      </div>
    );
  }

  if (phase === "loading" || !game) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p style={{ color: "var(--fg-2)" }}>Загрузка раунда…</p>
        </main>
      </div>
    );
  }

  const team = game.teams.find((t) => t.order === game.currentTeamIndex)!;
  const colorVar = teamColorVar(team.order);
  const currentWord = words[currentIndex];

  // ─── Round summary ───
  if (phase === "summary" || phase === "saving") {
    const answered = words.filter((w) => w.guessed !== null);
    const guessedCount = answered.filter((w) => w.guessed).length;
    const skipped = answered.filter((w) => !w.guessed).length;
    const score = guessedCount - (game.penaltySkip ? skipped : 0);
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 mx-auto w-full max-w-2xl px-4 md:px-8 py-8 md:py-12">
          <div className="eyebrow mb-2">ИТОГИ РАУНДА</div>
          <h1 className="h-title mb-2">Команда «{team.name}»</h1>
          <p className="text-sm mb-6" style={{ color: "var(--fg-2)" }}>
            Нажмите на слово, чтобы изменить статус.
          </p>

          <ul className="flex flex-col gap-2 mb-6 max-h-[55vh] overflow-y-auto">
            {answered.map((w) => (
              <li key={w.wordId}>
                <button
                  type="button"
                  onClick={() => toggleSummaryWord(w.wordId)}
                  className="w-full text-left px-4 py-3 rounded-md flex items-center gap-3 transition-colors"
                  style={
                    w.guessed
                      ? {
                          background:
                            "color-mix(in oklch, var(--accent) 10%, var(--bg-1))",
                          border: "1px solid var(--accent-line)",
                          color: "var(--accent)",
                        }
                      : {
                          background:
                            "color-mix(in oklch, var(--danger) 10%, var(--bg-1))",
                          border:
                            "1px solid color-mix(in oklch, var(--danger) 30%, transparent)",
                          color: "var(--danger)",
                        }
                  }
                >
                  <span className="inline-flex items-center justify-center w-5 h-5">
                    {w.guessed ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                  </span>
                  <span className="flex-1 font-medium">{w.text}</span>
                  <span className="font-mono text-xs opacity-80">
                    {w.guessed ? "+1" : game.penaltySkip ? "−1" : "0"}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <Card>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--fg-2)" }}>Угадано</span>
              <span className="font-bold" style={{ color: "var(--accent)" }}>
                +{guessedCount}
              </span>
            </div>
            {skipped > 0 && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span style={{ color: "var(--fg-2)" }}>Пропущено</span>
                <span style={{ color: game.penaltySkip ? "var(--danger)" : "var(--fg-2)" }}>
                  {game.penaltySkip ? `−${skipped}` : `${skipped} (без штрафа)`}
                </span>
              </div>
            )}
            <div
              className="flex items-center justify-between mt-3 pt-3 text-base font-bold"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <span>Итого за раунд</span>
              <span style={{ color: score >= 0 ? "var(--accent)" : "var(--danger)" }}>
                {score > 0 ? "+" : ""}
                {score}
              </span>
            </div>
          </Card>

          <Button
            block
            size="lg"
            disabled={phase === "saving"}
            onClick={confirm}
            className="mt-6"
          >
            {phase === "saving" ? "Сохраняем…" : "Подтвердить и передать ход"}
          </Button>
        </main>
      </div>
    );
  }

  // ─── Active round ───
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <header
        className="flex items-center justify-between px-4 md:px-8 py-3"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <Pill
          mono
          style={{
            background: `color-mix(in oklch, var(${colorVar}) 18%, var(--bg-2))`,
            color: `var(${colorVar})`,
          }}
        >
          {team.name} · {team.score}
        </Pill>
        <div className="eyebrow">РАУНД {game.currentRoundNumber}</div>
        <button
          type="button"
          onClick={() => {
            pause();
            setPauseOpen(true);
          }}
          aria-label="Пауза"
          className="w-9 h-9 flex items-center justify-center rounded-md"
          style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}
        >
          <Pause size={14} fill="currentColor" strokeWidth={0} />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-between p-4 md:p-8">
        {/* Timer */}
        <div className="text-center my-4">
          <div
            className="font-mono font-extrabold tabular-nums"
            style={{
              fontSize: "clamp(64px, 14vw, 96px)",
              color: timeLeft <= 5 ? "var(--danger)" : "var(--fg)",
              letterSpacing: "-0.04em",
            }}
          >
            {formatTime(timeLeft)}
          </div>
          <div
            className="mx-auto mt-2 h-1 rounded-full overflow-hidden"
            style={{
              width: 240,
              background: "var(--bg-3)",
            }}
          >
            <div
              className="h-full transition-[width] duration-300"
              style={{
                width: `${(timeLeft / game.roundTime) * 100}%`,
                background: timeLeft <= 5 ? "var(--danger)" : "var(--accent)",
              }}
            />
          </div>
        </div>

        {/* Word card */}
        <div className="flex-1 w-full max-w-xl flex items-center justify-center">
          {currentWord ? (
            <div
              key={currentWord.wordId}
              className="w-full rounded-2xl px-8 py-16 text-center relative"
              style={{
                background: "var(--bg-1)",
                border: "2px solid var(--accent-line)",
                boxShadow:
                  "0 0 0 1px var(--accent-soft), 0 24px 60px rgba(0,0,0,0.35)",
              }}
            >
              <div className="eyebrow mb-3">СЛОВО</div>
              <div
                className="font-extrabold leading-none"
                style={{
                  fontSize: "clamp(36px, 8vw, 56px)",
                  letterSpacing: "-0.02em",
                }}
              >
                {currentWord.text}
              </div>
            </div>
          ) : (
            <p style={{ color: "var(--fg-2)" }}>Слова закончились.</p>
          )}
        </div>

        {/* Action bar */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-xl">
          <button
            type="button"
            onClick={() => guess(false)}
            disabled={!currentWord}
            className="h-[72px] rounded-xl font-extrabold text-base inline-flex items-center justify-center gap-2 transition-transform active:translate-y-px disabled:opacity-50"
            style={{ background: "oklch(0.55 0.20 25)", color: "#fff" }}
          >
            <X size={20} strokeWidth={3} /> Пропуск
          </button>
          <button
            type="button"
            onClick={() => guess(true)}
            disabled={!currentWord}
            className="h-[72px] rounded-xl font-extrabold text-base inline-flex items-center justify-center gap-2 transition-transform active:translate-y-px disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            <Check size={20} strokeWidth={3} /> Угадал
          </button>
        </div>
      </main>

      {pauseOpen && (
        <PauseOverlay
          guessedCount={words.filter((w) => w.guessed === true).length}
          answeredCount={words.filter((w) => w.guessed !== null).length}
          timeLeft={timeLeft}
          onResume={() => {
            setPauseOpen(false);
            start();
          }}
          onEndRound={() => {
            setPauseOpen(false);
            handleTimeUp();
          }}
        />
      )}
    </div>
  );
}

function PauseOverlay({
  guessedCount,
  answeredCount,
  timeLeft,
  onResume,
  onEndRound,
}: {
  guessedCount: number;
  answeredCount: number;
  timeLeft: number;
  onResume: () => void;
  onEndRound: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--line-strong)",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-extrabold tracking-tight">Пауза</h3>
        </div>
        <p className="text-sm mb-5" style={{ color: "var(--fg-2)" }}>
          Раунд приостановлен. Продолжить или закончить досрочно?
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          <span
            className="font-mono text-[11px] px-2 py-1 rounded"
            style={{ background: "var(--bg-3)", color: "var(--fg-1)" }}
          >
            {guessedCount}/{answeredCount} угадано
          </span>
          <span
            className="font-mono text-[11px] px-2 py-1 rounded"
            style={{ background: "var(--bg-3)", color: "var(--fg-1)" }}
          >
            {formatTime(timeLeft)} осталось
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <Button block size="lg" onClick={onResume}>
            Продолжить
          </Button>
          <Button block size="lg" variant="danger" onClick={onEndRound}>
            Завершить раунд
          </Button>
        </div>
      </div>
    </div>
  );
}
