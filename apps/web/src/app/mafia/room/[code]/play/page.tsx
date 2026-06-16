"use client";

// Игровой экран Мафии. Рендерит по фазе из персонального MafiaView.
// Фаза 2: ROLE_REVEAL. Ночь/день/финал — заглушки (фазы 3–5).

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Moon } from "lucide-react";
import MafiaShell from "@/components/mafia/MafiaShell";
import RoleReveal from "@/components/mafia/RoleReveal";
import { useMafiaRoom } from "@/hooks/useMafiaRoom";
import { loadRoomCreds } from "@/lib/room-session";

export default function MafiaPlayPage() {
  const router = useRouter();
  const params = useParams();
  const code = String(params.code ?? "").toUpperCase();

  const creds = useMemo(() => (code ? loadRoomCreds(code) : null), [code]);
  const opts = useMemo(
    () =>
      creds
        ? { wsUrl: creds.wsUrl, token: creds.wsToken, code: creds.code, name: creds.displayName }
        : null,
    [creds],
  );
  const { socket, view, error } = useMafiaRoom(opts);

  useEffect(() => {
    if (code && !creds) router.replace(`/mafia/join?code=${code}`);
  }, [code, creds, router]);

  // Вернулись в лобби (партия не началась / сброшена).
  useEffect(() => {
    if (view && view.phase === "LOBBY") router.replace(`/mafia/room/${code}`);
  }, [view, code, router]);

  if (!creds || !view) {
    return (
      <MafiaShell>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "var(--mf-text-faint)" }}>{error ?? "Подключение…"}</p>
        </div>
      </MafiaShell>
    );
  }

  // ─── ROLE_REVEAL ───
  if (view.phase === "ROLE_REVEAL") {
    if (!view.you.role) {
      return (
        <MafiaShell>
          <Centered title="Раздаём роли…" sub="Подожди немного" />
        </MafiaShell>
      );
    }
    return (
      <MafiaShell vignette vignetteLevel={0.14}>
        <RoleReveal
          role={view.you.role}
          partners={view.you.partners}
          ready={view.you.ready}
          readyCount={view.readyCount}
          total={view.players.length}
          onReady={() => socket?.emit("mafia:ready", {}, () => {})}
        />
      </MafiaShell>
    );
  }

  // ─── Заглушки для фаз 3–5 (ночь/день/финал) ───
  return (
    <MafiaShell vignette vignetteLevel={0.16}>
      <div className="mf-phase-head">
        <div className="mf-phase-title">
          <Moon size={22} color="var(--mf-crimson)" />
          <span>{phaseTitle(view.phase, view.day)}</span>
        </div>
        {view.timer ? (
          <div className="mf-timer" style={{ fontSize: 22 }}>{fmt(view.timer.msLeft)}</div>
        ) : null}
      </div>
      <Centered
        title={view.phase === "NIGHT" ? "Город спит" : view.phase}
        sub="Этот экран появится в следующих обновлениях"
      />
    </MafiaShell>
  );
}

function phaseTitle(phase: string, day: number): string {
  switch (phase) {
    case "NIGHT":
      return `Ночь ${day}`;
    case "MORNING":
      return `Утро ${day}`;
    case "DISCUSSION":
      return `День ${day} — обсуждение`;
    case "VOTE":
      return `День ${day} — голосование`;
    case "VOTE_RESULT":
      return "Итог голосования";
    case "LAST_WORD":
      return "Последнее слово";
    case "FINISHED":
      return "Финал";
    default:
      return phase;
  }
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Centered({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 32px", textAlign: "center" }}>
      <div style={{ fontWeight: 800, fontSize: 32, letterSpacing: "-0.02em" }}>{title}</div>
      {sub ? <div style={{ fontWeight: 600, fontSize: 15, color: "var(--mf-text-dim)", lineHeight: 1.5 }}>{sub}</div> : null}
    </div>
  );
}
