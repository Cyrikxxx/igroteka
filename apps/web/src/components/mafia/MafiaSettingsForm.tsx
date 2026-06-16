"use client";

// Форма настроек партии Мафии: состав, таймеры, правила. Контролируемая.
// Используется на экране создания и в шите настроек лобби.

import { Crown, Search, HeartPulse, Skull, Minus, Plus } from "lucide-react";
import {
  computeComposition,
  describeComposition,
  type MafiaSettings,
} from "@alias/shared/mafia";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: "var(--mf-text-faint)",
        margin: "20px 0 4px",
      }}
    >
      {children}
    </div>
  );
}

function MfToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{
        width: 46,
        height: 27,
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        background: on ? "var(--mf-crimson)" : "var(--mf-surface-2)",
        position: "relative",
        transition: "background 0.15s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 22 : 3,
          width: 21,
          height: 21,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

function ToggleRow({
  icon: Icon,
  iconColor,
  label,
  sub,
  on,
  onChange,
}: {
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  iconColor?: string;
  label: string;
  sub?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="mf-setting-row">
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {Icon ? (
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.05)",
              color: iconColor ?? "var(--mf-text-dim)",
              flexShrink: 0,
            }}
          >
            <Icon size={18} />
          </span>
        ) : null}
        <div style={{ minWidth: 0 }}>
          <div className="mf-setting-label">{label}</div>
          {sub ? <div className="mf-setting-sub">{sub}</div> : null}
        </div>
      </div>
      <MfToggle on={on} onChange={onChange} />
    </div>
  );
}

function PresetChips({
  options,
  value,
  onChange,
}: {
  options: { label: string; v: number }[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          className={"mf-preset" + (value === o.v ? " on" : "")}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TimerRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; v: number }[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "11px 0",
        borderBottom: "1px solid var(--mf-border)",
      }}
    >
      <div className="mf-setting-label">{label}</div>
      <PresetChips options={options} value={value} onChange={onChange} />
    </div>
  );
}

const NIGHT_OPTS = [
  { label: "30 с", v: 30 },
  { label: "60 с", v: 60 },
  { label: "90 с", v: 90 },
];
const DISCUSSION_OPTS = [
  { label: "1 мин", v: 60 },
  { label: "2 мин", v: 120 },
  { label: "3 мин", v: 180 },
  { label: "5 мин", v: 300 },
];
const VOTE_OPTS = [
  { label: "30 с", v: 30 },
  { label: "45 с", v: 45 },
  { label: "60 с", v: 60 },
];
const LASTWORD_OPTS = [
  { label: "15 с", v: 15 },
  { label: "30 с", v: 30 },
  { label: "45 с", v: 45 },
];

export default function MafiaSettingsForm({
  value,
  onChange,
  playerCount,
}: {
  value: MafiaSettings;
  onChange: (next: MafiaSettings) => void;
  playerCount: number;
}) {
  const s = value;
  const setRole = (k: keyof MafiaSettings["roles"]) => (v: boolean) =>
    onChange({ ...s, roles: { ...s.roles, [k]: v } });
  const setRule = (k: keyof MafiaSettings["rules"]) => (v: boolean) =>
    onChange({ ...s, rules: { ...s.rules, [k]: v } });
  const setTimer = (k: keyof MafiaSettings["timers"]) => (v: number) =>
    onChange({ ...s, timers: { ...s.timers, [k]: v } });

  const manual = typeof s.mafiaCount === "number";
  const seg = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "9px 0",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    background: active ? "var(--mf-crimson)" : "transparent",
    color: active ? "#fff" : "var(--mf-text-dim)",
    transition: "background 0.15s",
  });

  const comp = computeComposition(Math.max(playerCount, 5), s);

  return (
    <div>
      <SectionLabel>Состав</SectionLabel>
      <div className="mf-setting-row">
        <div className="mf-setting-label">Мафия</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              display: "flex",
              background: "var(--mf-surface-2)",
              borderRadius: 12,
              padding: 3,
              width: 170,
            }}
          >
            <button
              type="button"
              style={seg(!manual)}
              onClick={() => onChange({ ...s, mafiaCount: "auto" })}
            >
              Авто
            </button>
            <button
              type="button"
              style={seg(manual)}
              onClick={() => onChange({ ...s, mafiaCount: manual ? (s.mafiaCount as number) : 2 })}
            >
              Вручную
            </button>
          </div>
          {manual ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="mf-btn mf-btn-surface"
                style={{ width: 34, height: 34, minHeight: 34, padding: 0, borderRadius: 9 }}
                onClick={() =>
                  onChange({ ...s, mafiaCount: Math.max(1, (s.mafiaCount as number) - 1) })
                }
              >
                <Minus size={16} />
              </button>
              <span className="mf-mono" style={{ minWidth: 18, textAlign: "center", fontWeight: 700 }}>
                {s.mafiaCount as number}
              </span>
              <button
                type="button"
                className="mf-btn mf-btn-surface"
                style={{ width: 34, height: 34, minHeight: 34, padding: 0, borderRadius: 9 }}
                onClick={() =>
                  onChange({ ...s, mafiaCount: Math.min(8, (s.mafiaCount as number) + 1) })
                }
              >
                <Plus size={16} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <ToggleRow icon={Crown} iconColor="var(--mf-gold)" label="Дон" sub="Решающий голос мафии" on={s.roles.don} onChange={setRole("don")} />
      <ToggleRow icon={Search} iconColor="var(--role-sheriff)" label="Шериф" sub="Ночные проверки" on={s.roles.sheriff} onChange={setRole("sheriff")} />
      <ToggleRow icon={HeartPulse} iconColor="var(--role-doctor)" label="Доктор" sub="Лечит одного за ночь" on={s.roles.doctor} onChange={setRole("doctor")} />
      <ToggleRow icon={Skull} iconColor="var(--role-maniac)" label="Маньяк" sub="Третья сила, сам за себя" on={s.roles.maniac} onChange={setRole("maniac")} />
      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          gap: 9,
          background: "rgba(225,29,72,0.07)",
          border: "1px solid rgba(225,29,72,0.25)",
          borderRadius: 14,
          padding: "11px 14px",
          fontSize: 13.5,
          fontWeight: 700,
          color: "var(--mf-text-dim)",
          lineHeight: 1.4,
        }}
      >
        {playerCount} игроков → <b style={{ color: "var(--mf-text)" }}>{describeComposition(comp)}</b>
      </div>

      <SectionLabel>Таймеры</SectionLabel>
      <TimerRow label="Ночь" options={NIGHT_OPTS} value={s.timers.night} onChange={setTimer("night")} />
      <TimerRow label="Обсуждение" options={DISCUSSION_OPTS} value={s.timers.discussion} onChange={setTimer("discussion")} />
      <TimerRow label="Голосование" options={VOTE_OPTS} value={s.timers.vote} onChange={setTimer("vote")} />
      <TimerRow label="Последнее слово" options={LASTWORD_OPTS} value={s.timers.lastWord} onChange={setTimer("lastWord")} />

      <SectionLabel>Правила</SectionLabel>
      <ToggleRow label="Первый день без голосования" on={s.rules.firstDayNoVote} onChange={setRule("firstDayNoVote")} />
      <ToggleRow label="Раскрывать роль погибших" on={s.rules.revealRoles} onChange={setRule("revealRoles")} />
      <ToggleRow label="Голоса видны при голосовании" on={s.rules.openVotes} onChange={setRule("openVotes")} />
      <ToggleRow label="Дон скрыт от шерифа" on={s.rules.donHiddenFromSheriff} onChange={setRule("donHiddenFromSheriff")} />
      <ToggleRow label="Зрители видят роли" on={s.rules.spectatorsSeeRoles} onChange={setRule("spectatorsSeeRoles")} />
    </div>
  );
}
