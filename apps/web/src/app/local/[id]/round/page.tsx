"use client";

// Локальная игра — раунд. Дизайн — GameScreen (объясняющий) + RoundSummary
// из редизайна. Логика сохранена: useTimer, угадал/пропустил, сохранение раунда.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowRight, Check, EyeOff, LogOut, Pause, Play, SkipForward, X } from "lucide-react";
import type { GameFromAPI, WordInRound } from "@/types";
import { useTimer } from "@/hooks/useTimer";
import { teamColorVar } from "@/constants/game";
import { formatTime } from "@/lib/utils";
import AppShell from "@/components/ui/AppShell";
import Avatar from "@/components/ui/Avatar";
import TimerRing from "@/components/game/TimerRing";

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
  const [flash, setFlash] = useState<"got" | "skip" | null>(null);

  const wordsRef = useRef(words);
  wordsRef.current = words;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const fetchedRef = useRef(false);

  const handleTimeUp = useCallback(() => {
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
        setWords(ws.map((w, i) => ({ wordId: w.id, text: w.text, guessed: null, order: i })));
        setPhase("active");
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [gameId, router]);

  // Стартуем таймер, как только игра загружена
  useEffect(() => {
    if (phase === "active" && game && !isRunning && timeLeft === game.roundTime) {
      start();
    }
  }, [phase, game, isRunning, timeLeft, start]);

  const guess = (guessed: boolean) => {
    setFlash(guessed ? "got" : "skip");
    setTimeout(() => setFlash(null), 280);
    setWords((prev) => {
      const next = [...prev];
      const idx = currentIndexRef.current;
      if (idx >= next.length) return prev;
      next[idx] = { ...next[idx], guessed };
      return next;
    });
    setCurrentIndex((i) => {
      const nextIdx = i + 1;
      if (nextIdx >= wordsRef.current.length) {
        setPhase("summary");
        pause();
      }
      return nextIdx;
    });
  };

  const toggleSummaryWord = (wordId: number) =>
    setWords((prev) => prev.map((w) => (w.wordId === wordId ? { ...w, guessed: !w.guessed } : w)));

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
          words: answered.map((w) => ({ wordId: w.wordId, guessed: w.guessed, order: w.order })),
        }),
      });
      if (!res.ok) throw new Error("Не удалось сохранить раунд");
      const result = (await res.json()) as { gameFinished: boolean };
      router.replace(result.gameFinished ? `/local/${gameId}/results` : `/local/${gameId}/turn`);
    } catch (e) {
      setError((e as Error).message);
      setPhase("summary");
    }
  };

  // ─── error / loading ───
  if (error && phase !== "summary" && phase !== "saving") {
    return (
      <AppShell centered>
        <div className="card" style={{ textAlign: "center", maxWidth: 460, marginInline: "auto" }}>
          <p style={{ color: "var(--danger)", marginBottom: 16 }}>{error}</p>
          <button type="button" className="btn btn-secondary" onClick={() => router.replace(`/local/${gameId}/turn`)}>
            Назад
          </button>
        </div>
      </AppShell>
    );
  }
  if (phase === "loading" || !game) {
    return (
      <AppShell centered>
        <p className="muted" style={{ textAlign: "center" }}>
          Загрузка раунда…
        </p>
      </AppShell>
    );
  }

  const team = game.teams.find((t) => t.order === game.currentTeamIndex)!;
  const colorVar = teamColorVar(team.order);
  const currentWord = words[currentIndex];
  const gotCount = words.filter((w) => w.guessed === true).length;
  const skipCount = words.filter((w) => w.guessed === false).length;

  // ─── Round summary ───
  if (phase === "summary" || phase === "saving") {
    const answered = words.filter((w) => w.guessed !== null);
    const guessedCount = answered.filter((w) => w.guessed).length;
    const skipped = answered.filter((w) => !w.guessed).length;
    const score = guessedCount - (game.penaltySkip ? skipped : 0);

    return (
      <AppShell centered className="screen-anim">
        <div className="summary-wrap">
          <div className="summary-left">
            <span className="eyebrow">итог раунда · команда «{team.name}»</span>
            <h1 className="h-display" style={{ margin: "12px 0" }}>
              {score > 0 ? "Отличный раунд!" : "Раунд завершён"}
            </h1>
            <p className="h-sub">
              Проверь слова — тапни, чтобы переключить «угадано / пропуск», если где-то ошиблись.
            </p>

            <div className="round-score">
              <div className="rs-big">
                <span
                  className={"rs-plus mono" + (score >= 0 ? " accent-text" : "")}
                  style={score < 0 ? { color: "var(--danger)" } : undefined}
                >
                  {score > 0 ? "+" : ""}
                  {score}
                </span>
                <span className="rs-l">очков за раунд</span>
              </div>
              <div className="rs-split">
                <div>
                  <b className="mono accent-text">{guessedCount}</b> угадано
                </div>
                <div>
                  <b className="mono">{skipped}</b> пропуск
                </div>
                <div>
                  <b className="mono">{team.score + score}</b> общий счёт
                </div>
              </div>
            </div>

            {error && (
              <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</p>
            )}
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              disabled={phase === "saving"}
              onClick={confirm}
            >
              {phase === "saving" ? (
                "Сохраняем…"
              ) : (
                <>
                  Подтвердить · передать ход <ArrowRight />
                </>
              )}
            </button>
          </div>

          <div className="card summary-words">
            <div className="row-between" style={{ marginBottom: 14 }}>
              <h2 className="h-title">Слова раунда</h2>
              <span className="pill pill-mono">{answered.length} слов</span>
            </div>
            <div className="words-list">
              {answered.map((w) => (
                <div
                  key={w.wordId}
                  className={"word-row " + (w.guessed ? "got" : "skip")}
                  onClick={() => toggleSummaryWord(w.wordId)}
                >
                  <span className="wr-ic">{w.guessed ? <Check size={15} /> : <X size={15} />}</span>
                  {w.text}
                  <span className="wr-pts">{w.guessed ? "+1" : game.penaltySkip ? "−1" : "0"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // ─── Active round (+ countdown) ───
  const player = team.players[team.currentPlayerIndex];
  const danger = phase === "active" && timeLeft <= 10;

  return (
    <AppShell noHeader bare>
      <div className={"game-screen screen-anim" + (danger ? " danger" : "")}>
        <div className="game-bg" />
        <div className="shell game-shell">
          <div className="game-top">
            <button
              type="button"
              className="back-link"
              onClick={() => {
                pause();
                router.push("/");
              }}
            >
              <LogOut /> Выйти
            </button>
            <div className="game-turn">
              <Avatar name={player.name} color={colorVar} size={34} />
              <div>
                <span className="gt-name">Твой ход</span>
                <span className="gt-team mono">
                  Команда «{team.name}» · раунд {game.currentRoundNumber}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                pause();
                setPauseOpen(true);
              }}
              aria-label="Пауза"
            >
              <Pause />
            </button>
          </div>

          <div className="game-center">
            <TimerRing value={timeLeft} total={game.roundTime} danger={danger} />

            {currentWord ? (
              <div className={"word-card-big" + (flash ? " flash-" + flash : "")} key={currentWord.wordId}>
                <span className="word-eyebrow">
                  <EyeOff size={13} /> видишь только ты
                </span>
                <strong className="word-main">{currentWord.text}</strong>
                <span className="word-index mono">слово {currentIndex + 1}</span>
              </div>
            ) : (
              <p className="muted">Слова закончились.</p>
            )}

            <div className="game-counts">
              <div className="gc gc-got">
                <Check /> {gotCount} <span>угадано</span>
              </div>
              <div className="gc gc-skip">
                <SkipForward /> {skipCount} <span>пропуск</span>
              </div>
            </div>
          </div>

          <div className="game-actions">
            <button type="button" className="game-btn skip" onClick={() => guess(false)} disabled={!currentWord}>
              <SkipForward size={24} /> Пропустил
            </button>
            <button type="button" className="game-btn got" onClick={() => guess(true)} disabled={!currentWord}>
              <Check size={26} /> Угадал
            </button>
          </div>
        </div>

        {pauseOpen && (
          <PauseOverlay
            guessedCount={gotCount}
            answeredCount={gotCount + skipCount}
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
    </AppShell>
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
    <div className="pause-overlay">
      <div className="pause-card card screen-anim">
        <Pause size={40} className="accent-text" />
        <h2 className="h-display">Пауза</h2>
        <p className="h-sub">
          Таймер заморожен на <b className="mono">{formatTime(timeLeft)}</b>. {guessedCount}/
          {answeredCount} угадано. Можно продолжить или завершить раунд.
        </p>
        <div className="pause-actions">
          <button type="button" className="btn btn-secondary" onClick={onEndRound}>
            <LogOut /> Завершить
          </button>
          <button type="button" className="btn btn-primary btn-lg" onClick={onResume}>
            <Play /> Продолжить
          </button>
        </div>
      </div>
    </div>
  );
}
