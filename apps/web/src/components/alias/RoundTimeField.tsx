"use client";

// Длительность раунда: готовые варианты плюс «Своё».
//
// Сервер принимал произвольное число секунд с самого начала, а форма умела
// только пять пресетов — за столом это заметили первым же вечером. Границы и
// кламп общие с серверными, см. constants.ts.

import {
  ROUND_TIME_OPTIONS,
  ROUND_TIME_LIMITS,
  clampRoundTime,
} from "@/constants/game";
import { Chip } from "@/components/common/Chip";
import { usePresetNumber } from "@/hooks/usePresetNumber";

/** «2 мин 30 с» — чтобы по секундам не считать в уме. */
export function fmtRoundTime(sec: number): string {
  if (sec < 60) return `${sec} с`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m} мин` : `${m} мин ${s} с`;
}

export default function RoundTimeField({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const field = usePresetNumber({
    value,
    presets: ROUND_TIME_OPTIONS,
    onChange,
    clamp: clampRoundTime,
  });

  return (
    <>
      <div className="chip-row">
        {ROUND_TIME_OPTIONS.map((v) => (
          <Chip key={v} active={field.isPicked(v)} onClick={() => field.pickPreset(v)}>
            {v} сек
          </Chip>
        ))}
        {field.manual ? (
          <input
            className="chip chip-num"
            type="number"
            inputMode="numeric"
            min={ROUND_TIME_LIMITS.min}
            max={ROUND_TIME_LIMITS.max}
            aria-label="Длительность раунда: своё время в секундах"
            value={field.inputValue}
            onChange={(e) => field.setDraft(e.target.value)}
            onBlur={field.commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        ) : (
          <Chip onClick={field.openManual}>Своё</Chip>
        )}
      </div>
      {field.manual ? (
        <div className="set-sub">
          Секунды, от {ROUND_TIME_LIMITS.min} до {ROUND_TIME_LIMITS.max}. Сейчас —{" "}
          {fmtRoundTime(value)}.
        </div>
      ) : null}
    </>
  );
}
