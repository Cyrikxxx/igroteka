"use client";

// Локальная игра — шаг 2: настройки. Дизайн — SettingsScreen из редизайна.
// Логика реальная: /api/categories → POST /api/games → /local/[id]/turn.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Minus, Play, Target } from "lucide-react";
import {
  loadLocalSetup,
  saveLocalSetup,
  clearLocalSetup,
  DEFAULT_LOCAL_SETUP,
  type LocalSetupState,
} from "@/lib/local-setup";
import { ROUND_TIME_OPTIONS, WIN_SCORE_OPTIONS } from "@/constants/game";
import { pluralize, WORDS, CATEGORIES } from "@/lib/plural";
import type { CatalogFromAPI, GameFromAPI } from "@/types";
import AppShell from "@/components/common/AppShell";
import Stepper from "@/components/common/Stepper";
import Chip from "@/components/common/Chip";
import Toggle from "@/components/common/Toggle";
import CategoryPicker from "@/components/alias/CategoryPicker";

export default function LocalSettingsPage() {
  const router = useRouter();
  const [state, setState] = useState<LocalSetupState>(DEFAULT_LOCAL_SETUP);
  const [catalog, setCatalog] = useState<CatalogFromAPI | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState(loadLocalSetup());
    setHydrated(true);
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: CatalogFromAPI) => setCatalog(data))
      .catch((e) => console.error(e));
  }, []);

  useEffect(() => {
    if (hydrated) saveLocalSetup(state);
  }, [state, hydrated]);

  const setRoundTime = (v: number) =>
    setState((s) => ({ ...s, settings: { ...s.settings, roundTime: v } }));
  const setWinScore = (v: number) =>
    setState((s) => ({ ...s, settings: { ...s.settings, winScore: v } }));
  const setPenaltySkip = (v: boolean) =>
    setState((s) => ({ ...s, settings: { ...s.settings, penaltySkip: v } }));
  const setCategoryIds = (ids: number[]) =>
    setState((s) => ({ ...s, settings: { ...s.settings, categoryIds: ids } }));

  const cats = state.settings.categoryIds;
  // Считает пикер: сложить счётчики выбранных категорий нельзя, уровни
  // намеренно пересекаются с темами.
  const [wordsInGame, setWordsInGame] = useState<number | null>(0);

  const onStart = async () => {
    if (cats.length === 0) return setError("Выберите хотя бы одну категорию.");
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: state.settings, teams: state.teams }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Не удалось создать игру");
        setSubmitting(false);
        return;
      }
      const game: GameFromAPI = await res.json();
      clearLocalSetup();
      router.replace(`/alias/local/${game.id}/turn`);
    } catch (e) {
      console.error(e);
      setError("Сеть/сервер недоступен. Попробуйте ещё раз.");
      setSubmitting(false);
    }
  };

  return (
    <AppShell className="screen-anim">
      <button type="button" className="back-link" onClick={() => router.push("/alias/local/new")}>
        <ArrowLeft /> Назад к командам
      </button>

      <div className="setup-head">
        <div>
          <Stepper step={2} />
          <h1 className="h-display" style={{ marginTop: 14 }}>
            Правила партии
          </h1>
          <p className="h-sub" style={{ marginTop: 8 }}>
            Настрой темп игры и выбери, о чём будут слова.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="stack">
          <div className="card">
            <div className="set-row">
              <div className="set-label">
                <Clock /> Длительность раунда
              </div>
              <div className="chip-row">
                {ROUND_TIME_OPTIONS.map((v) => (
                  <Chip key={v} active={state.settings.roundTime === v} onClick={() => setRoundTime(v)}>
                    {v} сек
                  </Chip>
                ))}
              </div>
            </div>
            <div className="dotted" style={{ margin: "20px 0" }} />
            <div className="set-row">
              <div className="set-label">
                <Target /> Цель по очкам
              </div>
              <div className="chip-row">
                {WIN_SCORE_OPTIONS.map((v) => (
                  <Chip key={v} active={state.settings.winScore === v} onClick={() => setWinScore(v)}>
                    {v}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="dotted" style={{ margin: "20px 0" }} />
            <div className="set-row">
              <div className="set-label">
                <Minus /> Штраф за пропуск
                <span className="set-hint">снимать −1 очко за пропущенное слово</span>
              </div>
              <Toggle checked={state.settings.penaltySkip} onChange={setPenaltySkip} />
            </div>
          </div>

          <div className="card summary-card">
            <span className="eyebrow">итог</span>
            <div className="summary-stats">
              <div>
                <b className="mono">{cats.length}</b>
                <span>категорий</span>
              </div>
              <div>
                <b className="mono">{wordsInGame ?? "…"}</b>
                <span>слов в игре</span>
              </div>
              <div>
                <b className="mono">{state.settings.roundTime}с</b>
                <span>раунд</span>
              </div>
              <div>
                <b className="mono">{state.settings.winScore}</b>
                <span>до победы</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="h-title" style={{ marginBottom: 4 }}>
            Во что играем
          </h2>
          <CategoryPicker
            catalog={catalog}
            selected={cats}
            onChange={setCategoryIds}
            onWordCount={setWordsInGame}
          />
        </div>
      </div>

      {error && (
        <div className="notice notice-danger" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      <div className="setup-foot">
        <span className="muted">
          {cats.length === 0
            ? "Выберите хотя бы одну категорию"
            : `${wordsInGame === null ? "…" : pluralize(wordsInGame, WORDS)} · выбрано ${pluralize(cats.length, CATEGORIES)}`}
        </span>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={submitting || cats.length === 0}
          onClick={onStart}
        >
          <Play /> {submitting ? "Создаём…" : "Начать игру"}
        </button>
      </div>
    </AppShell>
  );
}
