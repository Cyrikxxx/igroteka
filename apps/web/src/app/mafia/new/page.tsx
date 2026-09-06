"use client";

// Создание комнаты Мафии: шаг 1 — ник, шаг 2 — настройки партии.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  DEFAULT_MAFIA_SETTINGS,
  type MafiaSettings,
  type MafiaCreateRoomResponse,
} from "@alias/shared/mafia";
import { useHydrated } from "@/hooks/useHydrated";
import MafiaShell from "@/components/mafia/MafiaShell";
import MafiaAvatar from "@/components/mafia/MafiaAvatar";
import MafiaSettingsForm from "@/components/mafia/MafiaSettingsForm";
import {
  saveRoomCreds,
  saveDisplayName,
  loadDisplayName,
} from "@/lib/room-session";

export default function MafiaNewPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const hydrated = useHydrated();
  const [typedName, setTypedName] = useState<string | null>(null);
  const name = typedName ?? (hydrated ? loadDisplayName() : "");
  const setName = setTypedName;
  const [settings, setSettings] = useState<MafiaSettings>(() => ({
    mafiaCount: DEFAULT_MAFIA_SETTINGS.mafiaCount,
    roles: { ...DEFAULT_MAFIA_SETTINGS.roles },
    timers: { ...DEFAULT_MAFIA_SETTINGS.timers },
    rules: { ...DEFAULT_MAFIA_SETTINGS.rules },
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    const trimmed = name.trim().slice(0, 50);
    if (!trimmed) {
      setError("Введите имя");
      setStep(1);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/mafia/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName: trimmed, settings }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Не удалось создать комнату");
      }
      const data: MafiaCreateRoomResponse = await res.json();
      saveDisplayName(trimmed);
      saveRoomCreds({
        code: data.room.code,
        wsUrl: data.wsUrl,
        wsToken: data.wsToken,
        userId: data.user.id,
        displayName: data.user.displayName,
        game: "mafia",
      });
      router.replace(`/mafia/room/${data.room.code}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <MafiaShell>
      <div className="mf-phase-head" style={{ paddingBottom: 4 }}>
        <button
          type="button"
          className="mf-phase-title"
          style={{ background: "none", border: "none", color: "var(--mf-text)", cursor: "pointer", padding: 0 }}
          onClick={() => (step === 1 ? router.push("/mafia") : setStep(1))}
        >
          <ArrowLeft size={20} color="var(--mf-text-faint)" />
          <span style={{ fontSize: 18 }}>{step === 1 ? "Новая комната" : "Настройки игры"}</span>
        </button>
        <span className="mf-mono" style={{ fontSize: 13, color: "var(--mf-text-faint)", fontWeight: 700 }}>
          шаг {step} / 2
        </span>
      </div>

      {step === 1 ? (
        <>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "0 24px",
              gap: 14,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 30, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              Как тебя зовут?
            </div>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--mf-text-dim)" }}>
              Это имя увидят все игроки за столом
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "var(--mf-surface)",
                border: "1.5px solid var(--mf-crimson)",
                borderRadius: "var(--r-btn)",
                padding: "12px 16px",
                boxShadow: "0 0 24px rgba(225,29,72,0.15)",
              }}
            >
              <MafiaAvatar name={name || "?"} idx={1} size={32} />
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value.slice(0, 50));
                  setError(null);
                }}
                placeholder="Твоё имя"
                autoFocus
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--mf-text)",
                  fontWeight: 700,
                  fontSize: 18,
                }}
              />
            </div>
            {error ? (
              <div style={{ color: "var(--mf-crimson)", fontSize: 13, fontWeight: 700 }}>{error}</div>
            ) : null}
          </div>
          <div style={{ padding: "0 20px 24px" }}>
            <button
              type="button"
              className="mf-btn mf-btn-crimson"
              style={{ width: "100%", opacity: name.trim() ? 1 : 0.5 }}
              disabled={!name.trim()}
              onClick={() => setStep(2)}
            >
              Дальше <ArrowRight size={19} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ padding: "0 20px", flex: 1 }}>
            <MafiaSettingsForm value={settings} onChange={setSettings} playerCount={9} />
          </div>
          {error ? (
            <div style={{ padding: "0 20px", color: "var(--mf-crimson)", fontSize: 13, fontWeight: 700 }}>
              {error}
            </div>
          ) : null}
          <div style={{ padding: "18px 20px 24px" }}>
            <button
              type="button"
              className="mf-btn mf-btn-crimson"
              style={{ width: "100%" }}
              disabled={submitting}
              onClick={create}
            >
              {submitting ? "Создаём…" : "Создать комнату"}
            </button>
          </div>
        </>
      )}
    </MafiaShell>
  );
}
