"use client";

// Создание онлайн-комнаты хостом. Дизайн — CreateRoomScreen из редизайна.
// Логика реальная: /api/categories → /api/rooms → saveRoomCreds → лобби.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Minus, Sparkles, Target, Wifi } from "lucide-react";
import AppShell from "@/components/common/AppShell";
import Chip from "@/components/common/Chip";
import Toggle from "@/components/common/Toggle";
import CategoryPicker from "@/components/alias/CategoryPicker";
import {
  ROUND_TIME_OPTIONS,
  WIN_SCORE_OPTIONS,
  ROUND_TIME_DEFAULT,
  WIN_SCORE_DEFAULT,
  PENALTY_SKIP_DEFAULT,
} from "@/constants/game";
import type { CatalogFromAPI, CreateRoomResponse } from "@/types";
import { loadDisplayName, saveDisplayName, saveRoomCreds } from "@/lib/room-session";
import { plural, pluralize, CATEGORIES, WORDS } from "@/lib/plural";

export default function RoomNewPage() {
  const router = useRouter();
  const [hostName, setHostName] = useState("");
  const [title, setTitle] = useState("");
  const [roundTime, setRoundTime] = useState<number>(ROUND_TIME_DEFAULT);
  const [winScore, setWinScore] = useState<number>(WIN_SCORE_DEFAULT);
  const [penaltySkip, setPenaltySkip] = useState<boolean>(PENALTY_SKIP_DEFAULT);
  const [catalog, setCatalog] = useState<CatalogFromAPI | null>(null);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHostName(loadDisplayName());
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: CatalogFromAPI) => setCatalog(data))
      .catch(() => {});
  }, []);

  // Считает пикер: сложить счётчики выбранных категорий нельзя, уровни
  // намеренно пересекаются с темами.
  const [wordsInGame, setWordsInGame] = useState<number | null>(0);

  const roomTitle =
    title.trim() || (hostName.trim() ? `Комната ${hostName.trim()}` : "Комната хоста");
  const ready = hostName.trim().length > 0 && categoryIds.length > 0;

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
      router.replace(`/alias/room/${data.room.code}`);
    } catch {
      setError("Сеть/сервер недоступен");
      setSubmitting(false);
    }
  };

  return (
    <AppShell className="screen-anim">
      <button type="button" className="back-link" onClick={() => router.push("/alias")}>
        <ArrowLeft /> К Алиасу
      </button>

      <div className="setup-head">
        <div>
          <span className="eyebrow">онлайн · новая комната</span>
          <h1 className="h-display" style={{ marginTop: 10 }}>
            Создать комнату
          </h1>
          <p className="h-sub" style={{ marginTop: 8 }}>
            Задай имя и правила. Всё это можно поменять потом прямо в лобби.
          </p>
        </div>
        <div className="setup-counter">
          <span className="sc-v mono">{wordsInGame ?? "…"}</span>
          <span className="sc-l">
            {plural(wordsInGame ?? 0, WORDS)} · {pluralize(categoryIds.length, CATEGORIES)}
          </span>
        </div>
      </div>

      <div className="settings-grid">
        <div className="stack">
          {/* Идентичность комнаты */}
          <div className="card">
            <span className="eyebrow">комната</span>
            <label className="field-label" style={{ marginTop: 14 }}>
              Имя хоста
            </label>
            <input
              className="input"
              placeholder="Например, Макс"
              value={hostName}
              onChange={(e) => setHostName(e.target.value.slice(0, 50))}
              maxLength={50}
            />
            <label className="field-label" style={{ marginTop: 18 }}>
              Имя комнаты <span className="label-opt">необязательно</span>
            </label>
            <input
              className="input"
              placeholder={hostName.trim() ? `Комната ${hostName.trim()}` : "Комната хоста"}
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              maxLength={80}
            />
            <p className="field-note">
              <Sparkles size={13} /> Если пусто — назовём «{roomTitle}»
            </p>
          </div>

          {/* Правила */}
          <div className="card">
            <div className="set-row">
              <div className="set-label">
                <Clock /> Длительность раунда
              </div>
              <div className="chip-row">
                {ROUND_TIME_OPTIONS.map((v) => (
                  <Chip key={v} active={roundTime === v} onClick={() => setRoundTime(v)}>
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
                  <Chip key={v} active={winScore === v} onClick={() => setWinScore(v)}>
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
              <Toggle checked={penaltySkip} onChange={setPenaltySkip} />
            </div>
          </div>
        </div>

        {/* Во что играем */}
        <div className="card">
          <h2 className="h-title" style={{ marginBottom: 4 }}>
            Во что играем
          </h2>
          <CategoryPicker
            catalog={catalog}
            selected={categoryIds}
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
          {!hostName.trim()
            ? "Введите ваш ник"
            : categoryIds.length === 0
              ? "Выберите хотя бы одну категорию"
              : `«${roomTitle}» · ${roundTime}с · до ${winScore} · ${pluralize(categoryIds.length, CATEGORIES)}`}
        </span>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={submitting || !ready}
          onClick={onSubmit}
        >
          <Wifi /> {submitting ? "Создаём…" : "Создать комнату"}
        </button>
      </div>
    </AppShell>
  );
}
