"use client";

// Модалка «Настройки комнаты» для хоста в онлайн-лобби.
// Меняет правила партии до старта; сохранение → socket emit "room:settings".

import { useEffect, useState } from "react";
import { Check, Clock, Minus, Target } from "lucide-react";
import { ROUND_TIME_OPTIONS, WIN_SCORE_OPTIONS } from "@/constants/game";
import type { CategoryFromAPI } from "@/types";
import Modal from "@/components/ui/Modal";
import Chip from "@/components/ui/Chip";
import Toggle from "@/components/ui/Toggle";

export interface RoomSettings {
  roundTime: number;
  winScore: number;
  penaltySkip: boolean;
  categoryIds: number[];
}

interface RoomSettingsModalProps {
  open: boolean;
  settings: RoomSettings;
  onClose: () => void;
  onSave: (next: RoomSettings) => void;
}

export function RoomSettingsModal({ open, settings, onClose, onSave }: RoomSettingsModalProps) {
  const [roundTime, setRoundTime] = useState(settings.roundTime);
  const [winScore, setWinScore] = useState(settings.winScore);
  const [penaltySkip, setPenaltySkip] = useState(settings.penaltySkip);
  const [categoryIds, setCategoryIds] = useState<number[]>(settings.categoryIds);
  const [categories, setCategories] = useState<CategoryFromAPI[]>([]);

  // Сбрасываем форму к текущим настройкам при каждом открытии.
  useEffect(() => {
    if (!open) return;
    setRoundTime(settings.roundTime);
    setWinScore(settings.winScore);
    setPenaltySkip(settings.penaltySkip);
    setCategoryIds(settings.categoryIds);
  }, [open, settings]);

  useEffect(() => {
    if (open && categories.length === 0) {
      fetch("/api/categories")
        .then((r) => r.json())
        .then((data: CategoryFromAPI[]) => setCategories(data))
        .catch(() => {});
    }
  }, [open, categories.length]);

  const toggleCat = (id: number) =>
    setCategoryIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const save = () => {
    if (categoryIds.length === 0) return;
    onSave({ roundTime, winScore, penaltySkip, categoryIds });
  };

  return (
    <Modal isOpen={open} title="Настройки комнаты" onClose={onClose} maxWidth={640}>
      <div className="stack" style={{ gap: 18, maxHeight: "72vh", overflowY: "auto", paddingRight: 2 }}>
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

        <div className="set-row">
          <div className="set-label">
            <Minus /> Штраф за пропуск
          </div>
          <Toggle checked={penaltySkip} onChange={setPenaltySkip} />
        </div>

        <div>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <span className="field-label" style={{ margin: 0 }}>
              Категории слов
            </span>
            <span className="pill pill-mono">
              {categoryIds.length} / {categories.length || 10}
            </span>
          </div>
          <div className="cats-grid">
            {categories.map((cat) => {
              const on = categoryIds.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={"cat-card" + (on ? " on" : "")}
                  onClick={() => toggleCat(cat.id)}
                >
                  <span className="cat-check">
                    <Check size={14} />
                  </span>
                  <span className="cat-emoji">{cat.emoji}</span>
                  <span className="cat-name">{cat.name}</span>
                  <span className="cat-count">{cat._count?.words ?? 0} слов</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Отмена
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={categoryIds.length === 0}
          onClick={save}
        >
          Сохранить
        </button>
      </div>
    </Modal>
  );
}

export default RoomSettingsModal;
