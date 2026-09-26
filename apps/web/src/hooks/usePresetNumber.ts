"use client";

// Готовые варианты плюс «Своё» с ручным вводом — механика без разметки.
//
// Разметка у игр разная намеренно: у Мафии свои токены, у Алиаса — чипсы на
// акценте. А вот две тонкости общие, и обе неочевидны настолько, что их стоит
// держать в одном месте:
//
// 1. Клампить на каждой набранной цифре нельзя. Набирая «120», после первой
//    цифры человек получил бы минимум, и продолжить ввод стало бы невозможно.
//    Поэтому пока печатают, строка держится как есть, а кламп — на коммите.
// 2. Значение не из списка означает, что его уже задали руками, и поле должно
//    открыться сразу, а не прятаться за кнопкой «Своё».

import { useState } from "react";

export interface PresetNumberState {
  /** Открыт ли ручной ввод. */
  manual: boolean;
  /** Что показывать в поле: черновик, если печатают, иначе текущее значение. */
  inputValue: string;
  /** Выбран ли этот пресет. В ручном режиме не подсвечиваем ни один. */
  isPicked: (preset: number) => boolean;
  /** Печатают. */
  setDraft: (raw: string) => void;
  /** Ввод закончен: клампим и отдаём наверх. */
  commit: () => void;
  /** Нажали готовый вариант. */
  pickPreset: (v: number) => void;
  /** Открыть ручной ввод. */
  openManual: () => void;
}

export function usePresetNumber(args: {
  value: number;
  presets: readonly number[];
  onChange: (v: number) => void;
  /** Приводит введённое к допустимому. Общий с сервером — см. constants.ts. */
  clamp: (n: number) => number;
}): PresetNumberState {
  const { value, presets, onChange, clamp } = args;

  const [manual, setManual] = useState(() => !presets.includes(value));
  const [draft, setDraft] = useState<string | null>(null);

  return {
    manual,
    inputValue: draft ?? String(value),
    isPicked: (preset) => !manual && value === preset,
    setDraft: (raw) => setDraft(raw),
    commit: () => {
      const raw = draft;
      setDraft(null);
      if (raw === null) return;
      const n = Number(raw.replace(",", "."));
      // Пустое поле или мусор — молча возвращаемся к прежнему значению, а не
      // подставляем минимум: человек мог просто стереть и передумать.
      if (!Number.isFinite(n) || n <= 0) return;
      onChange(clamp(n));
    },
    pickPreset: (v) => {
      setManual(false);
      setDraft(null);
      onChange(v);
    },
    openManual: () => {
      setManual(true);
      setDraft(null);
    },
  };
}
