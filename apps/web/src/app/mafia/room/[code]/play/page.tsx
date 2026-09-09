"use client";

// Игровой экран Мафии. Рендерит по фазе из персонального MafiaView.
// Ночь — NightScreen; мёртвые/зрители — SpectatorScreen; поверх всего —
// служебные оверлеи (пауза, реконнект, смена хоста).

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Volume2, VolumeX } from "lucide-react";
import MafiaShell from "@/components/mafia/MafiaShell";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import RoleReveal from "@/components/mafia/RoleReveal";
import NightScreen, { NightHush } from "@/components/mafia/NightScreen";
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
import GameMenu from "@/components/mafia/GameMenu";
import {
  PauseOverlay,
  ReconnectOverlay,
  ClosedOverlay,
  HostToast,
  useHostToast,
  LeftToast,
  useLeftToast,
} from "@/components/mafia/Overlays";
import { useMafiaRoom } from "@/hooks/useMafiaRoom";
import { useNarrator } from "@/hooks/useNarrator";
import { useVoicePref } from "@/hooks/useVoicePref";
import { useHydrated } from "@/hooks/useHydrated";
import { useHostClaim } from "@/hooks/useHostClaim";
import { loadRoomCreds, clearRoomCreds, type RoomCredentials } from "@/lib/room-session";
import { resumeRoom } from "@/lib/room-resume";
import { setRoomNotice } from "@/lib/room-notice";

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

  const hydrated = useHydrated();
  const stored = useMemo(
    () => (hydrated ? loadRoomCreds(code) : null),
    [hydrated, code],
  );
  const [resumed, setResumed] = useState<RoomCredentials | null>(null);
  const creds = resumed ?? stored;

  // Креды живут во вкладке и умирают вместе с ней, а человек в комнате — нет:
  // сервер помнит его по куке. Поэтому если их нет — пробуем вернуться молча,
  // и только если сервер не узнал, отправляем на экран входа.
  useEffect(() => {
    if (!hydrated || stored) return;
    let alive = true;
    resumeRoom(code, "mafia").then((back) => {
      if (!alive) return;
      if (back.creds) {
        setResumed(back.creds);
        return;
      }
      // Комнаты уже нет — экран входа тут бесполезен: человек введёт имя и
      // получит тот же отказ. Объясняем на главной, что случилось.
      if (back.gone) {
        setRoomNotice({ text: back.notice ?? "Комната недоступна", tone: "danger" });
        router.replace("/mafia");
        return;
      }
      router.replace(`/mafia/join?code=${code}`);
    });
    return () => {
      alive = false;
    };
  }, [hydrated, stored, code, router]);
  const opts = useMemo(
    () =>
      creds
        ? { wsUrl: creds.wsUrl, token: creds.wsToken, code: creds.code, name: creds.displayName }
        : null,
    [creds],
  );
  const { emit, view: rawView, timer, status, error, closedReason } = useMafiaRoom(opts);

  // Экраны фаз показывают view.timer — а это цифра из последней рассылки
  // состояния, и между рассылками она стояла на месте: таймер выглядел
  // замершим. Живой остаток считает хук (тики сервера плюс локальная
  // интерполяция) — подмешиваем его в view, чтобы все экраны сразу пошли.
  const view = useMemo(
    () => (rawView ? { ...rawView, timer: timer ?? rawView.timer } : rawView),
    [rawView, timer],
  );

  // Озвучка — настройка ЭТОГО устройства: за столом восемь телефонов, и хором
  // они говорить не должны. В игре её можно только включить и выключить, сам
  // голос выбирается в лобби, в настройках хоста.
  const narratorMode = Boolean(view?.settings.narrator);
  const voice = useVoicePref(view?.you.isHost ?? false);
  useNarrator({
    narration: view?.narration,
    enabled: narratorMode && voice.on,
    paused: view?.paused,
  });

  const hostToast = useHostToast(view?.you.isHost ?? false);
  const leftToast = useLeftToast(view?.players ?? []);
  // Хост может пропасть и посреди партии — тогда комнату забирают прямо
  // отсюда, а не только из лобби.
  const claim = useHostClaim(view?.hostOfflineSince, view?.you.isHost ?? false);
  const claimHost = () => emit("mafia:claim_host", {}, () => {});
  // Экран «ты убит» показываем один раз, пока игрок сам не уйдёт в зрители.
  const [deathSeen, setDeathSeen] = useState(false);
  const [endGameAsk, setEndGameAsk] = useState(false);
  const [leaveAsk, setLeaveAsk] = useState(false);
  const [closeAsk, setCloseAsk] = useState(false);
  const alive = view?.you.alive ?? true;
  // Живому экран смерти не показываем, а отметка «уже посмотрел» действует
  // только для той смерти, на которой её поставили.
  const markDeathSeen = () => setDeathSeen(true);
  // Отметка держится до конца партии и сбрасывается, только если игрок снова
  // ожил — то есть началась новая партия тем же составом. Раньше она была
  // привязана к номеру дня, а он растёт с каждой ночью, поэтому объявление
  // «ты выбыл» вылезало заново каждую ночь поверх режима зрителя.
  //
  // Подгонка прямо при рендере, а не эффектом: так советует React, и лишней
  // перерисовки не будет.
  const [wasAlive, setWasAlive] = useState(alive);
  if (wasAlive !== alive) {
    setWasAlive(alive);
    if (alive) setDeathSeen(false);
  }

  // Выгнали или комнату закрыли — на главный экран Мафии с объяснением.
  useEffect(() => {
    if (!closedReason || !code) return;
    clearRoomCreds(code);
    setRoomNotice({ text: closedReason, tone: "danger" });
    router.replace("/mafia");
  }, [closedReason, code, router]);

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
  // Уход хоста значит разное в зависимости от момента. Партия доиграна —
  // комната больше не нужна, закрываем её для всех. Партия идёт — она не
  // должна умирать из-за одного ушедшего: хост выбывает как при смерти, а
  // права достаются тому, кто на связи.
  const leaveToHome = () => {
    const closesRoom = view.you.isHost && view.phase === "FINISHED";
    if (closesRoom) emit("mafia:close", {}, () => {});
    else emit("mafia:leave", {}, () => {});
    clearRoomCreds(code);
    router.push("/mafia");
  };
  const dead = !view.you.alive && !view.you.isSpectator;
  const exiled = me?.eliminatedBy === "vote";
  // Ночью в режиме ведущего остаток видит только тот, чей ход, — поэтому
  // паузу берём из отдельного поля, а не из таймера.
  const paused = view.paused;
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
            onReady={() => emit("mafia:ready", {}, () => {})}
            isHost={view.you.isHost}
            onStartNight={() => emit("mafia:start_night", {}, () => {})}
            onEndGame={() => setEndGameAsk(true)}
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
            onRematch={() => emit("mafia:restart", {}, () => {})}
            onHome={() => {
              // Раньше отсюда просто уходили со страницы: комната
              // оставалась висеть в Redis до дворника, а игроки — в ней.
              // Хосту закрытие необратимо — спрашиваем своим окном.
              if (view.you.isHost) setCloseAsk(true);
              else leaveToHome();
            }}
          />
          <ConfirmDialog
            open={closeAsk}
            variant="mafia"
            title="Закрыть комнату?"
            text="Все выйдут из неё. Вернуться в эту комнату будет нельзя."
            confirmLabel="Закрыть"
            onConfirm={() => {
              setCloseAsk(false);
              leaveToHome();
            }}
            onCancel={() => setCloseAsk(false)}
          />
        </MafiaShell>
      );
    }

    // Только что выбыл — сначала объявление, потом уже режим зрителя.
    if (dead && !deathSeen) {
      return (
        <MafiaShell vignette vignetteLevel={0.2}>
          <YouDeadScreen exiled={exiled} onWatch={markDeathSeen} />
        </MafiaShell>
      );
    }

    // В режиме ведущего мёртвые и зрители сидят за тем же столом: свечение
    // экрана и реакция выдают не меньше слов, поэтому ночью у них темно.
    if ((dead || view.you.isSpectator) && view.night) {
      return (
        <MafiaShell vignette vignetteLevel={0.16}>
          <NightHush day={view.day} />
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
              emit("mafia:night_action", { action, targetId }, () => {})
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
            onEnd={() => emit("mafia:end_discussion", {}, () => {})}
          />
        </MafiaShell>
      );
    }

    if (view.phase === "VOTE") {
      return (
        <MafiaShell>
          <VoteScreen
            view={view}
            onVote={(targetId) => emit("mafia:vote", { targetId }, () => {})}
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
            onDone={() => emit("mafia:last_word_done", {}, () => {})}
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

      {/* Служебное меню: пауза, завершение партии, захват комнаты и выход.
          Раньше здесь была одна кнопка паузы, и выйти из партии было нечем. */}
      <GameMenu
        isHost={view.you.isHost}
        canPause={canPause}
        paused={paused}
        canClaimHost={claim.canClaim}
        claimSecondsLeft={claim.secondsLeft}
        hostGone={claim.hostGone}
        onPause={() => emit("mafia:pause", {}, () => {})}
        onResume={() => emit("mafia:resume", {}, () => {})}
        onEndGame={() => setEndGameAsk(true)}
        onClaimHost={claimHost}
        onLeave={() => setLeaveAsk(true)}
      />

      {narratorMode ? (
        <button
          type="button"
          aria-label={voice.on ? "Выключить озвучку на этом устройстве" : "Озвучивать на этом устройстве"}
          onClick={() => voice.toggle()}
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 70,
            width: 44,
            height: 44,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: voice.on ? "var(--mf-crimson)" : "var(--mf-surface-2)",
            border: "1px solid var(--mf-border)",
            color: voice.on ? "#fff" : "var(--mf-text-dim)",
            cursor: "pointer",
          }}
        >
          {voice.on ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
      ) : null}

      {/* Реплика ведущего текстом: у части телефонов русского голоса нет, и
          стол должен уметь играть, читая с экрана. */}
      {narratorMode && view.narration ? (
        <div
          role="status"
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            bottom: 72,
            zIndex: 65,
            margin: "0 auto",
            maxWidth: 420,
            padding: "10px 14px",
            borderRadius: 14,
            textAlign: "center",
            fontSize: 13.5,
            fontWeight: 700,
            lineHeight: 1.4,
            color: "var(--mf-text-dim)",
            background: "rgba(5,5,9,0.72)",
            border: "1px solid var(--mf-border)",
          }}
        >
          {view.narration.text}
        </div>
      ) : null}

      {paused ? (
        <PauseOverlay
          isHost={view.you.isHost}
          onResume={() => emit("mafia:resume", {}, () => {})}
          onEndGame={() => setEndGameAsk(true)}
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

      <ConfirmDialog
        open={endGameAsk}
        variant="mafia"
        title="Завершить партию?"
        text="Партия оборвётся, все вернутся в лобби. Комната останется — можно пересобрать состав и сыграть заново."
        confirmLabel="Завершить"
        onConfirm={() => {
          setEndGameAsk(false);
          emit("mafia:end_game", {}, () => {});
        }}
        onCancel={() => setEndGameAsk(false)}
      />

      <ConfirmDialog
        open={leaveAsk}
        variant="mafia"
        title="Выйти из игры?"
        text="Для тебя партия закончится: вернуться в неё будет нельзя. Остальные доиграют без тебя."
        confirmLabel="Выйти"
        onConfirm={() => {
          setLeaveAsk(false);
          leaveToHome();
        }}
        onCancel={() => setLeaveAsk(false)}
      />

      <HostToast show={hostToast.show} onClose={hostToast.close} />
      <LeftToast name={leftToast.name} inLobby={leftToast.inLobby} onClose={leftToast.close} />
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
