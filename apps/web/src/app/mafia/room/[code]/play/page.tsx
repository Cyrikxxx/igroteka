"use client";

// Игровой экран Мафии. Рендерит по фазе из персонального MafiaView.
// Ночь — NightScreen; мёртвые/зрители — SpectatorScreen. День/финал — фаза 4–5.

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import MafiaShell from "@/components/mafia/MafiaShell";
import RoleReveal from "@/components/mafia/RoleReveal";
import NightScreen from "@/components/mafia/NightScreen";
import SpectatorScreen from "@/components/mafia/SpectatorScreen";
import {
  MorningScreen,
  DiscussionScreen,
  VoteScreen,
  VoteResultScreen,
  LastWordScreen,
} from "@/components/mafia/DayScreens";
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

  const me = view.players.find((p) => p.userId === view.you.userId);
  const dead = !view.you.alive && !view.you.isSpectator;
  const exiled = me?.eliminatedBy === "vote";

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

  // ─── Мёртвые / зрители ───
  if (dead || view.you.isSpectator) {
    return (
      <MafiaShell vignette vignetteLevel={view.phase === "NIGHT" ? 0.16 : 0.05}>
        <SpectatorScreen view={view} exiled={exiled} />
      </MafiaShell>
    );
  }

  // ─── NIGHT ───
  if (view.phase === "NIGHT") {
    return (
      <MafiaShell vignette vignetteLevel={view.you.role === "maniac" ? 0.1 : 0.16}>
        <NightScreen
          view={view}
          onAction={(action, targetId) =>
            socket?.emit("mafia:night_action", { action, targetId }, () => {})
          }
        />
      </MafiaShell>
    );
  }

  // ─── MORNING ───
  if (view.phase === "MORNING") {
    return (
      <MafiaShell vignette vignetteLevel={view.spotlight ? 0.12 : 0.04}>
        <MorningScreen view={view} />
      </MafiaShell>
    );
  }

  // ─── DISCUSSION ───
  if (view.phase === "DISCUSSION") {
    return (
      <MafiaShell>
        <DiscussionScreen
          view={view}
          isHost={view.you.isHost}
          onEnd={() => socket?.emit("mafia:end_discussion", {}, () => {})}
        />
      </MafiaShell>
    );
  }

  // ─── VOTE ───
  if (view.phase === "VOTE") {
    return (
      <MafiaShell>
        <VoteScreen
          view={view}
          onVote={(targetId) => socket?.emit("mafia:vote", { targetId }, () => {})}
        />
      </MafiaShell>
    );
  }

  // ─── VOTE_RESULT ───
  if (view.phase === "VOTE_RESULT") {
    return (
      <MafiaShell vignette vignetteLevel={0.1}>
        <VoteResultScreen view={view} />
      </MafiaShell>
    );
  }

  // ─── LAST_WORD ───
  if (view.phase === "LAST_WORD") {
    return (
      <MafiaShell vignette vignetteLevel={0.08}>
        <LastWordScreen
          view={view}
          isHost={view.you.isHost}
          onDone={() => socket?.emit("mafia:last_word_done", {}, () => {})}
        />
      </MafiaShell>
    );
  }

  // ─── FINISHED (фаза 5) — временная заглушка ───
  return (
    <MafiaShell vignette vignetteLevel={0.05}>
      <Centered
        title={view.winner === "city" ? "Победа города" : view.winner === "mafia" ? "Победа мафии" : view.winner === "maniac" ? "Победа маньяка" : "Партия окончена"}
        sub="Итоговый экран появится в следующем обновлении"
      />
    </MafiaShell>
  );
}

function Centered({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 32px", textAlign: "center" }}>
      <div style={{ fontWeight: 800, fontSize: 32, letterSpacing: "-0.02em" }}>{title}</div>
      {sub ? <div style={{ fontWeight: 600, fontSize: 15, color: "var(--mf-text-dim)", lineHeight: 1.5 }}>{sub}</div> : null}
    </div>
  );
}
