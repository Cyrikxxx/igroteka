"use client";

// Создание онлайн-комнаты хостом. Объединяет в одну страницу те же
// поля, что и /local/settings (время, очки, штраф, категории) +
// поля онлайна (ник хоста, название комнаты).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/ui/Header";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import Input from "@/components/ui/Input";
import Toggle from "@/components/ui/Toggle";
import Button from "@/components/ui/Button";
import {
  ROUND_TIME_OPTIONS,
  WIN_SCORE_OPTIONS,
  ROUND_TIME_DEFAULT,
  WIN_SCORE_DEFAULT,
  PENALTY_SKIP_DEFAULT,
} from "@/constants/game";
import type { CategoryFromAPI, CreateRoomResponse } from "@/types";
import {
  loadDisplayName,
  saveDisplayName,
  saveRoomCreds,
} from "@/lib/room-session";

export default function RoomNewPage() {
  const router = useRouter();
  const [hostName, setHostName] = useState("");
  const [title, setTitle] = useState("");
  const [roundTime, setRoundTime] = useState<number>(ROUND_TIME_DEFAULT);
  const [winScore, setWinScore] = useState<number>(WIN_SCORE_DEFAULT);
  const [penaltySkip, setPenaltySkip] = useState<boolean>(PENALTY_SKIP_DEFAULT);
  const [categories, setCategories] = useState<CategoryFromAPI[]>([]);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHostName(loadDisplayName());
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: CategoryFromAPI[]) => setCategories(data))
      .catch(() => {});
  }, []);

  const totalWordsInBank = categories
    .filter((c) => categoryIds.includes(c.id))
    .reduce((sum, c) => sum + (c._count?.words ?? 0), 0);

  const toggleCategory = (id: number) => {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const onSubmit = async () => {
    setError(null);
    const name = hostName.trim();
    if (!name) return setError("Введите ваш ник");
    if (categoryIds.length === 0) return setError("Выберите хотя бы одну категорию");

    setSubmitting(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostName: name,
          title: title.trim() || undefined,
          settings: { roundTime, winScore, penaltySkip, categoryIds },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "Не удалось создать комнату");
        setSubmitting(false);
        return;
      }
      const data: CreateRoomResponse = await res.json();
      saveDisplayName(name);
      saveRoomCreds({
        code: data.room.code,
        wsUrl: data.wsUrl,
        wsToken: data.wsToken,
        userId: data.user.id,
        displayName: data.user.displayName,
      });
      router.replace(`/room/${data.room.code}`);
    } catch {
      setError("Сеть/сервер недоступен");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 md:px-8 py-8 md:py-12">
        <div className="eyebrow mb-3">CREATE A ROOM</div>
        <h1 className="h-display mb-8">Создать комнату</h1>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="text-base font-bold mb-3">О хосте</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor="hostName" className="eyebrow block mb-2">
                  ВАШ НИК
                </label>
                <Input
                  id="hostName"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value.slice(0, 50))}
                  placeholder="Например, Ваня"
                />
              </div>
              <div>
                <label htmlFor="title" className="eyebrow block mb-2">
                  НАЗВАНИЕ КОМНАТЫ · опционально
                </label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                  placeholder="Например, Пятничный созвон"
                />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Время раунда</h2>
              <span
                className="font-mono text-xs px-2 py-0.5 rounded"
                style={{ background: "var(--bg-3)", color: "var(--fg-1)" }}
              >
                {roundTime} сек
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ROUND_TIME_OPTIONS.map((v) => (
                <Chip key={v} active={roundTime === v} onClick={() => setRoundTime(v)}>
                  {v}
                </Chip>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Очки для победы</h2>
              <span
                className="font-mono text-xs px-2 py-0.5 rounded"
                style={{ background: "var(--bg-3)", color: "var(--fg-1)" }}
              >
                {winScore} очков
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {WIN_SCORE_OPTIONS.map((v) => (
                <Chip key={v} active={winScore === v} onClick={() => setWinScore(v)}>
                  {v}
                </Chip>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Штраф за пропуск</h2>
                <p className="text-sm mt-1" style={{ color: "var(--fg-2)" }}>
                  Минус 1 очко за каждое пропущенное слово
                </p>
              </div>
              <Toggle checked={penaltySkip} onChange={setPenaltySkip} />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3 gap-3">
              <div>
                <h2 className="text-base font-bold">Категории</h2>
                <p className="text-sm mt-1" style={{ color: "var(--fg-2)" }}>
                  Выбрано {categoryIds.length} · {totalWordsInBank} слов в банке
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCategoryIds(categories.map((c) => c.id))}
                  className="text-xs font-semibold underline"
                  style={{ color: "var(--accent)" }}
                >
                  Все
                </button>
                <span style={{ color: "var(--fg-3)" }}>·</span>
                <button
                  type="button"
                  onClick={() => setCategoryIds([])}
                  className="text-xs font-semibold underline"
                  style={{ color: "var(--fg-2)" }}
                >
                  Очистить
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {categories.map((cat) => {
                const active = categoryIds.includes(cat.id);
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
          <Button variant="ghost" size="lg" onClick={() => router.push("/")}>
            ← Назад
          </Button>
          <Button size="lg" disabled={submitting} onClick={onSubmit}>
            {submitting ? "Создаём…" : "Создать комнату →"}
          </Button>
        </div>
      </main>
    </div>
  );
}
