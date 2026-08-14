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
import { pluralize, WORDS } from "@/lib/plural";
import AppShell from "@/components/common/AppShell";
import Avatar from "@/components/common/Avatar";
import Modal from "@/components/common/Modal";
import TimerRing from "@/components/alias/game/TimerRing";

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

  const { timeLeft, start, pause } = useTimer({
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
          router.replace(`/alias/local/${gameId}/results`);
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

  // Пускаем таймер ровно один раз, когда игра загрузилась. Через ref, а не
  // через сравнение timeLeft с длительностью раунда: иначе пауза, поставленная
  // в первые доли секунды, тут же снималась бы этим эффектом.
  const startedRef = useRef(false);
  useEffect(() => {
    if (phase === "active" && game && !startedRef.current) {
      startedRef.current = true;
      start();
    }
  }, [phase, game, start]);

  // Слова кончились раньше таймера — закрываем раунд. Раньше это делалось
  // прямо внутри updater'а setCurrentIndex, а updater обязан быть чистым:
  // в dev-режиме React вызывает его дважды.
  useEffect(() => {
    if (phase === "active" && words.length > 0 && currentIndex >= words.length) {
      pause();
      setPhase("summary");
    }
  }, [phase, currentIndex, words.length, pause]);

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
    setCurrentIndex((i) => i + 1);
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
      router.replace(result.gameFinished ? `/alias/local/${gameId}/results` : `/alias/local/${gameId}/turn`);
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
          <button type="button" className="btn btn-secondary" onClick={() => router.replace(`/alias/local/${gameId}/turn`)}>
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
              <span className="pill pill-mono">{pluralize(answered.length, WORDS)}</span>
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
                // Раунд не сохраняется, счёт этой попытки пропадёт —
                // раньше уходили молча по одному нажатию.
                if (window.confirm("Выйти из партии? Текущий раунд не засчитается.")) {
                  router.push("/alias");
                } else {
                  start();
                }
              }}
            >
              <LogOut /> Выйти
            </button>
            <div className="game-turn">
              <Avatar name={player.name} color={colorVar} size={40} />
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

        {/* Раньше здесь был свой оверлей мимо Modal — из-за этого Esc не
            закрывал паузу, фокус уходил за диалог, а фон продолжал
            скроллиться. Онлайн-режим давно использует общий Modal. */}
        <Modal
          isOpen={pauseOpen}
          title="Пауза"
          onClose={() => {
            setPauseOpen(false);
            start();
          }}
        >
          <p className="muted" style={{ marginBottom: 18 }}>
            Таймер заморожен на <b className="mono">{formatTime(timeLeft)}</b>. {gotCount}/
            {gotCount + skipCount} угадано. Можно продолжить или завершить раунд.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => {
                setPauseOpen(false);
                handleTimeUp();
              }}
            >
              <LogOut /> Завершить
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => {
                setPauseOpen(false);
                start();
              }}
            >
              <Play /> Продолжить
            </button>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
