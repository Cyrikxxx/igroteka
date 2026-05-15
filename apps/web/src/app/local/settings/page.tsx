"use client";

// Setup step 2: настройки игры. См. DESIGN.md §5.2 SettingsScreen.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadLocalSetup,
  saveLocalSetup,
  clearLocalSetup,
  DEFAULT_LOCAL_SETUP,
  type LocalSetupState,
} from "@/lib/local-setup";
import {
  ROUND_TIME_OPTIONS,
  WIN_SCORE_OPTIONS,
} from "@/constants/game";
import { CategoryFromAPI, GameFromAPI } from "@/types";
import Header from "@/components/ui/Header";
import Stepper from "@/components/ui/Stepper";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import Toggle from "@/components/ui/Toggle";
import Button from "@/components/ui/Button";

export default function LocalSettingsPage() {
  const router = useRouter();
  const [state, setState] = useState<LocalSetupState>(DEFAULT_LOCAL_SETUP);
  const [categories, setCategories] = useState<CategoryFromAPI[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState(loadLocalSetup());
    setHydrated(true);
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: CategoryFromAPI[]) => {
        setCategories(data);
        // По умолчанию ничего не выбрано — пользователь сам выбирает.
        // Если уже сохранено в setup — оставляем.
      })
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
  const toggleCategory = (id: number) =>
    setState((s) => {
      const has = s.settings.categoryIds.includes(id);
      return {
        ...s,
        settings: {
          ...s.settings,
          categoryIds: has
            ? s.settings.categoryIds.filter((x) => x !== id)
            : [...s.settings.categoryIds, id],
        },
      };
    });

  const selectAll = () =>
    setState((s) => ({
      ...s,
      settings: { ...s.settings, categoryIds: categories.map((c) => c.id) },
    }));
  const clearAll = () =>
    setState((s) => ({ ...s, settings: { ...s.settings, categoryIds: [] } }));

  const totalWordsInBank = categories
    .filter((c) => state.settings.categoryIds.includes(c.id))
    .reduce((sum, c) => sum + (c._count?.words ?? 0), 0);

  const onStart = async () => {
    if (state.settings.categoryIds.length === 0) {
      setError("Выберите хотя бы одну категорию.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: state.settings,
          teams: state.teams,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Не удалось создать игру");
        setSubmitting(false);
        return;
      }
      const game: GameFromAPI = await res.json();
      clearLocalSetup();
      router.replace(`/local/${game.id}/turn`);
    } catch (e) {
      console.error(e);
      setError("Сеть/сервер недоступен. Попробуйте ещё раз.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 md:px-8 py-8 md:py-12">
        <div className="mb-6">
          <Stepper step={2} />
        </div>
        <h1 className="h-display mb-8">Настройки</h1>

        <div className="flex flex-col gap-4">
          {/* Время раунда */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">Время раунда</h2>
              <span
                className="font-mono text-xs px-2 py-0.5 rounded"
                style={{ background: "var(--bg-3)", color: "var(--fg-1)" }}
              >
                {state.settings.roundTime} сек
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ROUND_TIME_OPTIONS.map((v) => (
                <Chip
                  key={v}
                  active={state.settings.roundTime === v}
                  onClick={() => setRoundTime(v)}
                >
                  {v}
                </Chip>
              ))}
            </div>
          </Card>

          {/* Очки для победы */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">Очки для победы</h2>
              <span
                className="font-mono text-xs px-2 py-0.5 rounded"
                style={{ background: "var(--bg-3)", color: "var(--fg-1)" }}
              >
                {state.settings.winScore} очков
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {WIN_SCORE_OPTIONS.map((v) => (
                <Chip
                  key={v}
                  active={state.settings.winScore === v}
                  onClick={() => setWinScore(v)}
                >
                  {v}
                </Chip>
              ))}
            </div>
          </Card>

          {/* Штраф за пропуск */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Штраф за пропуск</h2>
                <p className="text-sm mt-1" style={{ color: "var(--fg-2)" }}>
                  Минус 1 очко за каждое пропущенное слово
                </p>
              </div>
              <Toggle
                checked={state.settings.penaltySkip}
                onChange={setPenaltySkip}
              />
            </div>
          </Card>

          {/* Категории */}
          <Card>
            <div className="flex items-center justify-between mb-4 gap-3">
              <div>
                <h2 className="text-base font-bold">Категории</h2>
                <p className="text-sm mt-1" style={{ color: "var(--fg-2)" }}>
                  Выбрано {state.settings.categoryIds.length} · {totalWordsInBank} слов в банке
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs font-semibold underline"
                  style={{ color: "var(--accent)" }}
                >
                  Все
                </button>
                <span style={{ color: "var(--fg-3)" }}>·</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs font-semibold underline"
                  style={{ color: "var(--fg-2)" }}
                >
                  Очистить
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {categories.map((cat) => {
                const active = state.settings.categoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className="text-left rounded-md p-3 transition-colors min-h-[64px] relative"
                    style={{
                      background: active
                        ? "color-mix(in oklch, var(--accent) 10%, var(--bg-2))"
                        : "var(--bg-2)",
                      border: active
                        ? "1px solid var(--accent-line)"
                        : "1px solid var(--line)",
                    }}
                  >
                    <div className="absolute top-2 right-2 text-base opacity-70">
                      {cat.emoji}
                    </div>
                    <div
                      className="text-[13px] font-bold pr-6"
                      style={{ color: active ? "var(--accent)" : "var(--fg-1)" }}
                    >
                      {cat.name}
                    </div>
                    <div
                      className="font-mono text-[11px] mt-1"
                      style={{ color: "var(--fg-2)" }}
                    >
                      {cat._count?.words ?? 0} слов
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {error && (
          <div
            className="mt-6 p-3 rounded-md text-sm"
            style={{
              background: "color-mix(in oklch, var(--danger) 12%, var(--bg-2))",
              color: "var(--danger)",
              border: "1px solid color-mix(in oklch, var(--danger) 30%, transparent)",
            }}
          >
            {error}
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse md:flex-row gap-3 md:justify-between">
          <Button variant="ghost" size="lg" onClick={() => router.push("/local/new")}>
            ← Назад к командам
          </Button>
          <Button size="lg" disabled={submitting} onClick={onStart}>
            {submitting ? "Создаём…" : "Начать игру →"}
          </Button>
        </div>
      </main>
    </div>
  );
}
