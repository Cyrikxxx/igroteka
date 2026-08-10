"use client";

// Игровой экран Мафии. Рендерит по фазе из персонального MafiaView.
// Ночь — NightScreen; мёртвые/зрители — SpectatorScreen; поверх всего —
// служебные оверлеи (пауза, реконнект, смена хоста).

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pause } from "lucide-react";
import MafiaShell from "@/components/mafia/MafiaShell";
import RoleReveal from "@/components/mafia/RoleReveal";
import NightScreen from "@/components/mafia/NightScreen";
import SpectatorScreen from "@/components/mafia/SpectatorScreen";
import YouDeadScreen from "@/components/mafia/YouDeadScreen";
import {
  MorningScreen,
  DiscussionScreen,
  VoteScreen,
  VoteResultScreen,
  LastWordScreen,
} from "@/components/mafia/DayScreens";
import FinaleScreen from "@/components/mafia/FinaleScreen";
import {
  PauseOverlay,
  ReconnectOverlay,
  ClosedOverlay,
  HostToast,
  useHostToast,
} from "@/components/mafia/Overlays";
import { useMafiaRoom } from "@/hooks/useMafiaRoom";
import { loadRoomCreds, clearRoomCreds } from "@/lib/room-session";

/** Фазы, которые идут по таймеру — только их и можно ставить на паузу. */
const PAUSABLE = new Set([
  "NIGHT",
  "MORNING",
  "DISCUSSION",
  "VOTE",
  "VOTE_RESULT",
  "LAST_WORD",
]);

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
  const { socket, view, status, error } = useMafiaRoom(opts);
  const hostToast = useHostToast(view?.you.isHost ?? false);
  // Экран «ты убит» показываем один раз, пока игрок сам не уйдёт в зрители.
  const [deathSeen, setDeathSeen] = useState(false);
  const alive = view?.you.alive ?? true;
  useEffect(() => {
    if (alive) setDeathSeen(false);
  }, [alive]);

  useEffect(() => {
    if (code && !creds) router.replace(`/mafia/join?code=${code}`);
  }, [code, creds, router]);

  // Партия закончилась и хост позвал играть заново — возвращаемся в лобби.
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
  const paused = Boolean(view.timer?.paused);
  const canPause = view.you.isHost && PAUSABLE.has(view.phase) && !paused;

  function screen() {
    if (!view) return null;

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

    // Финал показываем всем, включая выбывших: там раскрываются роли.
    if (view.phase === "FINISHED") {
      return (
        <MafiaShell wide vignette vignetteLevel={0.06}>
          <FinaleScreen
            view={view}
            isHost={view.you.isHost}
            onRematch={() => socket?.emit("mafia:restart", {}, () => {})}
            onHome={() => {
              clearRoomCreds(code);
              router.push("/");
            }}
          />
        </MafiaShell>
      );
    }

    // Только что выбыл — сначала объявление, потом уже режим зрителя.
    if (dead && !deathSeen) {
      return (
        <MafiaShell vignette vignetteLevel={0.2}>
          <YouDeadScreen exiled={exiled} onWatch={() => setDeathSeen(true)} />
        </MafiaShell>
      );
    }

    if (dead || view.you.isSpectator) {
      return (
        <MafiaShell vignette vignetteLevel={view.phase === "NIGHT" ? 0.16 : 0.05}>
          <SpectatorScreen view={view} exiled={exiled} />
        </MafiaShell>
      );
    }

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

    if (view.phase === "MORNING") {
      return (
        <MafiaShell vignette vignetteLevel={view.spotlight ? 0.12 : 0.04}>
          <MorningScreen view={view} />
        </MafiaShell>
      );
    }

    if (view.phase === "DISCUSSION") {
      return (
        <MafiaShell>
          <DiscussionScreen
            view={view}
            isHost={view.you.isHost}
            onEnd={() => socket?.emit("mafia:end_discussion", {}, () => {})}
            onRemovePlayer={(id) =>
              socket?.emit("mafia:remove_player", { userId: id }, () => {})
            }
          />
        </MafiaShell>
      );
    }

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

    if (view.phase === "VOTE_RESULT") {
      return (
        <MafiaShell vignette vignetteLevel={0.1}>
          <VoteResultScreen view={view} />
        </MafiaShell>
      );
    }

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

    return (
      <MafiaShell>
        <Centered title="Загрузка…" />
      </MafiaShell>
    );
  }

  return (
    <>
      {screen()}

      {canPause ? (
        <button
          type="button"
          aria-label="Поставить на паузу"
          onClick={() => socket?.emit("mafia:pause", {}, () => {})}
          style={{
            position: "fixed",
            left: 16,
            bottom: 16,
            zIndex: 70,
            width: 44,
            height: 44,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--mf-surface-2)",
            border: "1px solid var(--mf-border)",
            color: "var(--mf-text-dim)",
            cursor: "pointer",
          }}
        >
          <Pause size={19} />
        </button>
      ) : null}

      {paused ? (
        <PauseOverlay
          isHost={view.you.isHost}
          onResume={() => socket?.emit("mafia:resume", {}, () => {})}
        />
      ) : null}

      {status === "reconnecting" ? <ReconnectOverlay /> : null}

      {status === "closed" ? (
        <ClosedOverlay
          reason={error}
          onHome={() => {
            clearRoomCreds(code);
            router.push("/");
          }}
        />
      ) : null}

      <HostToast show={hostToast.show} onClose={hostToast.close} />
    </>
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
