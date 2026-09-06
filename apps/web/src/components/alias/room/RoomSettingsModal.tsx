"use client";

// Модалка «Настройки комнаты» для хоста в онлайн-лобби.
// Меняет правила партии до старта; сохранение → socket emit "room:settings".

import { useEffect, useState } from "react";
import { Clock, Minus, Target } from "lucide-react";
import { ROUND_TIME_OPTIONS, WIN_SCORE_OPTIONS } from "@/constants/game";
import type { CatalogFromAPI } from "@/types";
import CategoryPicker from "@/components/alias/CategoryPicker";
import Modal from "@/components/common/Modal";
import Chip from "@/components/common/Chip";
import Toggle from "@/components/common/Toggle";

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
  // Каталог держим снаружи формы: иначе он грузился бы заново при каждом
  // открытии окна.
  const [catalog, setCatalog] = useState<CatalogFromAPI | null>(null);

  useEffect(() => {
    if (open && !catalog) {
      fetch("/api/categories")
        .then((r) => r.json())
        .then((data: CatalogFromAPI) => setCatalog(data))
        .catch(() => {});
    }
  }, [open, catalog]);

  return (
    <Modal isOpen={open} title="Настройки комнаты" onClose={onClose} maxWidth={640}>
      {/* Форма перемонтируется на каждое открытие — так она и сбрасывается к
          текущим настройкам, без подгонки состояния эффектом. */}
      {open ? (
        <SettingsForm
          key={`${settings.roundTime}|${settings.winScore}|${settings.penaltySkip}|${settings.categoryIds.join(",")}`}
          settings={settings}
          catalog={catalog}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </Modal>
  );
}

function SettingsForm({
  settings,
  catalog,
  onClose,
  onSave,
}: {
  settings: RoomSettings;
  catalog: CatalogFromAPI | null;
  onClose: () => void;
  onSave: (next: RoomSettings) => void;
}) {
  const [roundTime, setRoundTime] = useState(settings.roundTime);
  const [winScore, setWinScore] = useState(settings.winScore);
  const [penaltySkip, setPenaltySkip] = useState(settings.penaltySkip);
  const [categoryIds, setCategoryIds] = useState<number[]>(settings.categoryIds);

  const save = () => {
    if (categoryIds.length === 0) return;
    onSave({ roundTime, winScore, penaltySkip, categoryIds });
  };

  return (
    <>
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
          <span className="field-label" style={{ margin: 0 }}>
            Во что играем
          </span>
          <CategoryPicker catalog={catalog} selected={categoryIds} onChange={setCategoryIds} />
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
    </>
  );
}

export default RoomSettingsModal;
