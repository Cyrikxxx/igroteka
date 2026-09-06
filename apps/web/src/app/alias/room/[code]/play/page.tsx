"use client";

// Игровой экран онлайн-режима. Три роли: explainer / guesser / spectator.
// Дизайн — GameScreen / RoundSummary из редизайна. Вся realtime-логика
// (useRoom, фазы, socket.emit, приватность роли, модалки) сохранена.

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Clock, DoorClosed, EyeOff, LogOut, Pause, Play, RefreshCw, SkipForward, Users, X } from "lucide-react";
import { nextExplainerFor } from "@alias/shared/snapshot-builders";
import { loadRoomCreds, clearRoomCreds } from "@/lib/room-session";
import { resumeRoom } from "@/lib/room-resume";
import { setRoomNotice } from "@/lib/room-notice";
import { useRoom } from "@/hooks/useRoom";
import { useHostClaim } from "@/hooks/useHostClaim";
import { useHydrated } from "@/hooks/useHydrated";
import { pluralize, WORDS } from "@/lib/plural";
import AppShell from "@/components/common/AppShell";
import Avatar from "@/components/common/Avatar";
import Modal from "@/components/common/Modal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import TimerRing from "@/components/alias/game/TimerRing";
import VictoryView from "@/components/alias/game/VictoryView";
import type { GameFromAPI } from "@/types";

interface Creds {
  code: string;
  wsUrl: string;
  wsToken: string;
  userId: string;
  displayName: string;
}

type Role = "explainer" | "guesser" | "spectator";

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const rawCode = (params.code as string).toUpperCase();
  const hydrated = useHydrated();
  const stored = useMemo(
    () => (hydrated ? loadRoomCreds(rawCode) : null),
    [hydrated, rawCode],
  );
  const [resumed, setResumed] = useState<Creds | null>(null);
  const creds = resumed ?? stored;

  // Креды живут во вкладке и умирают вместе с ней, а человек в комнате — нет:
  // сервер помнит его по куке. Поэтому если их нет — пробуем вернуться молча,
  // и только если сервер не узнал, отправляем на экран входа.
  useEffect(() => {
    if (!hydrated || stored) return;
    let alive = true;
    resumeRoom(rawCode, "alias").then((back) => {
      if (!alive) return;
      if (back) setResumed(back);
      else router.replace(`/alias/join?code=${rawCode}`);
    });
    return () => {
      alive = false;
    };
  }, [hydrated, stored, rawCode, router]);

  const opts = useMemo(
    () => (creds ? { wsUrl: creds.wsUrl, token: creds.wsToken, code: creds.code } : null),
    [creds],
  );
  const { emit, snapshot, tick, currentWord, wordCount, review, error, status, closedReason } =
    useRoom(opts);

  // Хоста нет в сети — комнату можно забрать. На игровом экране это важнее,
  // чем в лобби: без хоста некому нажать «Завершить игру», и партия, которая
  // ждёт пропавшего объясняющего, не кончится вообще никак.
  const claim = useHostClaim(
    snapshot?.hostOfflineSince,
    !!creds && snapshot?.hostId === creds.userId,
  );

  // Выгнали или комнату закрыли — на главный экран Алиаса с объяснением.
  useEffect(() => {
    if (!closedReason) return;
    clearRoomCreds(rawCode);
    setRoomNotice({ text: closedReason, tone: "danger" });
    router.replace("/alias");
  }, [closedReason, rawCode, router]);

  // Редирект назад в лобби, если игра ещё не началась
  useEffect(() => {
    if (!snapshot || !creds) return;
    if (snapshot.phase === "LOBBY") {
      router.replace(`/alias/room/${creds.code}`);
    }
  }, [snapshot?.phase, creds, router]);

  // ВНИМАНИЕ: все хуки должны быть до любых ранних return.
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [leaveAsk, setLeaveAsk] = useState(false);
  const [closeAsk, setCloseAsk] = useState(false);
  const [endGameAsk, setEndGameAsk] = useState(false);
  // Ошибки действий раньше проглатывались пустым коллбэком: человек жал
  // кнопку, ничего не происходило, и понять почему было нельзя.
  const [actionError, setActionError] = useState<string | null>(null);

  // Итоги финала: снапшот комнаты знает только счёт, а подиуму нужны
  // составы команд — берём готовую Game по её id.
  const [finalGame, setFinalGame] = useState<GameFromAPI | null>(null);
  const finishedGameId = snapshot?.phase === "FINISHED" ? snapshot.gameId : null;
  useEffect(() => {
    if (!finishedGameId) {
      setFinalGame(null);
      return;
    }
    let alive = true;
    fetch(`/api/games/${finishedGameId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((g: GameFromAPI | null) => {
        if (alive) setFinalGame(g);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [finishedGameId]);

  const prevPausedRef = useRef(false);
  useEffect(() => {
    const prev = prevPausedRef.current;
    const curr = !!tick?.paused;
    prevPausedRef.current = curr;
    if (prev && !curr && pauseModalOpen) {
      setPauseModalOpen(false);
    }
  }, [tick?.paused, pauseModalOpen]);

  if (!creds || !snapshot) {
    return (
      <AppShell centered>
        <p className="muted" style={{ textAlign: "center" }}>
          {error ? `Ошибка: ${error}` : "Подключаемся…"}
        </p>
      </AppShell>
    );
  }

  const myTeam = snapshot.teams.find((t) => t.players.some((p) => p.userId === creds.userId));
  const activeTeam = snapshot.teams.find((t) => t.id === snapshot.currentTeamId);
  const isExplainer = snapshot.currentPlayerId === creds.userId;
  const isMyTeamActive = myTeam && myTeam.id === snapshot.currentTeamId;
  // Втроём угадывает один названный человек, а не «вся моя команда»: в
  // активной команде и так один игрок, и третий должен видеть себя зрителем.
  const trio = (snapshot.format ?? "TEAMS") === "TRIO";
  const role: Role = isExplainer
    ? "explainer"
    : trio
      ? snapshot.currentGuesserId === creds.userId
        ? "guesser"
        : "spectator"
      : isMyTeamActive
        ? "guesser"
        : "spectator";
  const explainerPlayer = activeTeam?.players.find((p) => p.userId === snapshot.currentPlayerId);
  const guesserName =
    snapshot.teams
      .flatMap((t) => t.players)
      .find((p) => p.userId === snapshot.currentGuesserId)?.displayName ?? "?";

  const onGuess = (guessed: boolean) => {
    if (!currentWord) return;
    emit("round:guess", { wordId: currentWord.wordId, guessed }, () => {});
  };
  const onPause = () => {
    emit("round:pause", {}, () => {});
    setPauseModalOpen(true);
  };
  const onResume = () => {
    emit("round:resume", {}, () => {});
    setPauseModalOpen(false);
  };
  const onEndRequest = () => setEndConfirmOpen(true);
  const onEndConfirm = () => {
    emit("round:end", { confirm: true }, () => {});
    setEndConfirmOpen(false);
    setPauseModalOpen(false);
  };
  const onReviewToggle = (wordId: number) => emit("round:review_toggle", { wordId }, () => {});
  const onReviewConfirm = () =>
    emit("round:review_confirm", {}, (resp: unknown) => {
      if (resp && typeof resp === "object" && "error" in (resp as Record<string, unknown>)) {
        setActionError(
          (resp as { error: string }).error === "next_explainer_offline"
            ? "Следующий объясняющий не в сети — ход передать некому."
            : `Не удалось передать ход: ${(resp as { error: string }).error}`,
        );
      }
    });
  // Зритель посреди партии выйти может — на ход он не влияет. Игроку команды
  // сервер откажет: состав на время игры заморожен.
  const doLeave = () => {
    emit("room:leave", {}, () => {});
    router.push("/alias");
  };
  // Хост обрывает партию — единственный выход, когда ждём того, кто не
  // вернётся. Счёт остаётся, все попадают на итоги, оттуда «Сыграть ещё».
  const doEndGame = () => {
    emit("round:end_game", {}, (resp: unknown) => {
      if (resp && typeof resp === "object" && "error" in (resp as Record<string, unknown>)) {
        setActionError(`Не удалось завершить партию: ${(resp as { error: string }).error}`);
      }
    });
    setEndGameAsk(false);
  };

  // После партии выход означает разное: хост закрывает комнату для всех,
  // игрок уходит один. Это же правило действует и в Мафии.
  const isRoomHost = creds.userId === snapshot.hostId;
  const doLeaveAfterGame = () => {
    if (isRoomHost) emit("room:close", {}, () => {});
    else emit("room:leave", {}, () => {});
    clearRoomCreds(creds.code);
    router.push("/alias");
  };
  // Спрашиваем только там, где отменить уже нельзя: уход посреди раунда и
  // закрытие комнаты хостом. Спрашиваем своим окном, а не системным.
  const onLeave = () => setLeaveAsk(true);
  const onLeaveAfterGame = () => {
    if (isRoomHost) setCloseAsk(true);
    else doLeaveAfterGame();
  };

  const canControlRound = role === "explainer" || creds.userId === snapshot.hostId;
  const showReconnectOverlay = status === "reconnecting" || (status === "error" && !!error);

  // Объясняющий пропал — раунд стоит на паузе, время не горит. Снимет паузу
  // он сам, когда вернётся: автоматически возобновлять нельзя, иначе первые
  // секунды сгорят, пока у него грузится страница.
  const explainerOffline =
    snapshot.phase === "ROUND_ACTIVE" && explainerPlayer !== undefined && !explainerPlayer.online;
  const paused = Boolean(tick?.paused ?? snapshot.timer?.paused);
  const canResumeAfterDrop = role === "explainer" && paused && snapshot.phase === "ROUND_ACTIVE";

  // Ход нельзя передать тому, кого нет в сети: он его просто не увидит.
  // Ровно это же правило проверяет сервер.
  const nextUp = nextExplainerFor(snapshot);
  const nextExplainerOffline = !!nextUp && !nextUp.player.online;
  // Только зритель уходит посреди партии; игрока команды сервер не выпустит.
  const canLeaveMidGame = role === "spectator" && !myTeam;

  const teamColor = activeTeam?.color ?? "--team-1";
  const teamName = activeTeam?.name ?? "—";
  const explainerName = explainerPlayer?.displayName ?? "?";
  /** Чей это ход — словами. Втроём это пара, а не название команды. */
  const pairName = trio ? `${explainerName} и ${guesserName}` : `команда «${teamName}»`;
  const roundTime = snapshot.settings.roundTime;
  const sec = Math.max(0, Math.ceil((tick?.msLeft ?? 0) / 1000));
  const danger = snapshot.phase === "ROUND_ACTIVE" && sec <= 10;
  const got = wordCount?.got ?? 0;
  const skip = wordCount?.skip ?? 0;

  const claimHost = () =>
    emit("room:claim_host", {}, (resp: unknown) => {
      if (resp && typeof resp === "object" && "error" in (resp as Record<string, unknown>)) {
        setActionError(`Не удалось забрать комнату: ${(resp as { error: string }).error}`);
      }
    });

  const claimBanner = claim.hostGone ? (
    <div className="notice notice-warn room-claim" style={{ margin: "0 0 12px" }}>
      <span style={{ flex: 1 }}>
        {claim.canClaim
          ? "Хост не в сети. Возьми комнату на себя, чтобы управлять партией."
          : `Хост не в сети. Взять комнату на себя можно через ${claim.secondsLeft} с.`}
      </span>
      {claim.canClaim && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={claimHost}>
          Взять комнату на себя
        </button>
      )}
    </div>
  ) : null;

  const hostEndGameBar = !isRoomHost ? null : nextExplainerOffline ? (
    <div className="notice notice-warn room-claim">
      <span style={{ flex: 1 }}>
        {nextUp?.player.displayName ?? "Следующий игрок"} не в сети — ход передать некому.
        Можно подождать его или завершить игру.
      </span>
      <button type="button" className="btn btn-danger btn-sm" onClick={() => setEndGameAsk(true)}>
        Завершить игру
      </button>
    </div>
  ) : (
    <div className="room-claim" style={{ justifyContent: "flex-end" }}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEndGameAsk(true)}>
        <DoorClosed size={15} /> Завершить игру
      </button>
    </div>
  );

  const modals = (
    <>
      <ConfirmDialog
        open={leaveAsk}
        title="Выйти из комнаты?"
        text="Текущий раунд не засчитается. Вернуться можно будет по тому же коду."
        confirmLabel="Выйти"
        onConfirm={() => {
          setLeaveAsk(false);
          doLeave();
        }}
        onCancel={() => setLeaveAsk(false)}
      />
      <ConfirmDialog
        open={closeAsk}
        title="Закрыть комнату?"
        text="Все выйдут из неё. Вернуться в эту комнату будет нельзя."
        confirmLabel="Закрыть"
        onConfirm={() => {
          setCloseAsk(false);
          doLeaveAfterGame();
        }}
        onCancel={() => setCloseAsk(false)}
      />
      <ConfirmDialog
        open={endGameAsk}
        title="Завершить игру?"
        text="Партия закончится с текущим счётом, все увидят итоги. Комната останется — можно будет собрать состав заново и сыграть ещё."
        confirmLabel="Завершить"
        onConfirm={doEndGame}
        onCancel={() => setEndGameAsk(false)}
      />

      <Modal isOpen={pauseModalOpen && canControlRound} title="Пауза" onClose={onResume}>
        <p className="muted" style={{ marginBottom: 18 }}>
          Раунд приостановлен. Таймер не идёт, пока модалка открыта.
        </p>
        <div className="col" style={{ gap: 8 }}>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onResume}>
            Продолжить
          </button>
          <button type="button" className="btn btn-danger btn-block" onClick={onEndRequest}>
            Завершить раунд
          </button>
        </div>
      </Modal>

      <Modal isOpen={endConfirmOpen} title="Завершить раунд?" onClose={() => setEndConfirmOpen(false)}>
        <p className="muted" style={{ marginBottom: 18 }}>
          Раунд будет засчитан с текущим счётом. Передадим ход следующей команде.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={() => setEndConfirmOpen(false)}
          >
            Отмена
          </button>
          <button type="button" className="btn btn-danger" style={{ flex: 1 }} onClick={onEndConfirm}>
            Да, завершить
          </button>
        </div>
      </Modal>

      <Modal isOpen={showReconnectOverlay} fullscreen>
        <div style={{ textAlign: "center" }}>
          <div className="row" style={{ justifyContent: "center", gap: 8, marginBottom: 14 }}>
            <span className="pulse dot" style={{ color: "var(--warn)" }} />
            <span className="eyebrow" style={{ color: "var(--warn)" }}>
              Соединение потеряно
            </span>
          </div>
          <h2 className="h-title" style={{ marginBottom: 8 }}>
            Переподключаемся…
          </h2>
          <p className="muted">
            {status === "reconnecting"
              ? "Сервер не отвечает. Пытаемся подключиться заново."
              : error ?? "Что-то пошло не так."}
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 18 }}
            onClick={() => router.push("/alias")}
          >
            Выйти к Алиасу
          </button>
        </div>
      </Modal>
    </>
  );

  // ─── PRE_ROUND / ROUND_ACTIVE — иммерсивный игровой экран ───
  if (snapshot.phase === "PRE_ROUND" || snapshot.phase === "ROUND_ACTIVE") {
    const active = snapshot.phase === "ROUND_ACTIVE";
    return (
      <>
        <AppShell bare>
          <div className={"game-screen" + (danger ? " danger" : "")}>
            <div className="game-bg" />
            <div className="shell game-shell">
              <GameTop
                role={role}
                trio={trio}
                explainerName={explainerName}
                guesserName={guesserName}
                teamName={teamName}
                teamColor={teamColor}
                roundNumber={snapshot.currentRoundNumber}
                onLeave={canLeaveMidGame ? onLeave : null}
                onEndGame={isRoomHost ? () => setEndGameAsk(true) : null}
                onPause={onPause}
              />

              {/* Объясняющий пропал: раунд стоит, время не горит. Ждём его —
                  вернётся и продолжит с того же места. */}
              {explainerOffline && (
                <div className="notice notice-warn" style={{ margin: "0 0 12px" }}>
                  <div className="row-between" style={{ gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--warn)" }}>
                        {explainerName} не в сети — раунд на паузе
                      </div>
                      <p className="muted" style={{ fontSize: 12, margin: "2px 0 0" }}>
                        Время не идёт. Ждём, пока он вернётся и продолжит сам.
                      </p>
                    </div>
                    {isRoomHost && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setEndGameAsk(true)}
                      >
                        Завершить игру
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Вернувшийся объясняющий снимает паузу сам: иначе первые
                  секунды сгорят, пока у него грузится страница. */}
              {canResumeAfterDrop && (
                <div className="notice notice-warn" style={{ margin: "0 0 12px" }}>
                  <div className="row-between" style={{ gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700 }}>Раунд на паузе</span>
                    <button type="button" className="btn btn-primary btn-sm" onClick={onResume}>
                      <Play /> Продолжить
                    </button>
                  </div>
                </div>
              )}

              {claimBanner}

              {actionError && (
                <div className="notice notice-danger" style={{ margin: "0 0 12px" }}>
                  {actionError}
                </div>
              )}

              <div className="game-center">
                <TimerRing value={active ? sec : roundTime} total={roundTime} danger={danger} />

                {!active ? (
                  <p className="muted" style={{ textAlign: "center" }}>
                    {role === "explainer"
                      ? "Приготовься! Сейчас покажем слово."
                      : role === "guesser"
                        ? "Слушай и угадывай."
                        : "Смотри за раундом."}
                  </p>
                ) : role === "explainer" ? (
                  currentWord ? (
                    <div className="word-card-big" key={currentWord.wordId}>
                      <span className="word-eyebrow">
                        <EyeOff size={13} /> видишь только ты
                      </span>
                      <strong className="word-main">{currentWord.text}</strong>
                      <span className="word-index mono">слово {got + skip + 1}</span>
                    </div>
                  ) : (
                    <p className="muted">Жду слово…</p>
                  )
                ) : (
                  <div className="guesser-card">
                    <div className={"guesser-pulse" + (role === "spectator" ? " spectate" : "")}>
                      <EyeOff size={30} />
                    </div>
                    <span className="guesser-hidden mono">
                      <EyeOff size={14} /> слово скрыто
                    </span>
                    <p className="muted" style={{ margin: 0 }}>
                      {role === "spectator"
                        ? `Наблюдаешь за раундом. ${explainerName} объясняет своей команде — слово видит только он.`
                        : "Слушай и выкрикивай слово вслух — очко засчитает объясняющий."}
                    </p>
                  </div>
                )}

                <div className={"game-counts" + (role === "explainer" ? "" : " game-counts--big")}>
                  <div className="gc gc-got">
                    <Check /> {got} <span>угадано</span>
                  </div>
                  <div className="gc gc-skip">
                    <SkipForward /> {skip} <span>пропуск</span>
                  </div>
                </div>
              </div>

              {active && role === "explainer" ? (
                <div className="game-actions">
                  <button
                    type="button"
                    className="game-btn skip"
                    onClick={() => onGuess(false)}
                    disabled={!currentWord || tick?.paused}
                  >
                    <SkipForward size={24} /> Пропустил
                  </button>
                  <button
                    type="button"
                    className="game-btn got"
                    onClick={() => onGuess(true)}
                    disabled={!currentWord || tick?.paused}
                  >
                    <Check size={26} /> Угадал
                  </button>
                </div>
              ) : active ? (
                <div className="guesser-foot">
                  <span className="pill pill-mono">
                    <Clock size={14} /> ход переходит по таймеру
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </AppShell>
        {modals}
      </>
    );
  }

  // ─── ROUND_REVIEW — итог раунда ───
  if (snapshot.phase === "ROUND_REVIEW") {
    return (
      <>
        <AppShell centered className="screen-anim">
          {claimBanner}
          {hostEndGameBar}
          {actionError && (
            <div className="notice notice-danger" style={{ marginBottom: 12 }}>
              {actionError}
            </div>
          )}
          <ReviewView
            trio={trio}
            pairName={pairName}
            role={role}
            review={review}
            penaltySkip={snapshot.settings.penaltySkip}
            onToggle={onReviewToggle}
            onConfirm={onReviewConfirm}
            isExplainer={isExplainer}
            nextExplainerOffline={nextExplainerOffline}
            nextExplainerName={nextUp?.player.displayName ?? "Следующий игрок"}
          />
        </AppShell>
        {modals}
      </>
    );
  }

  // ─── BETWEEN_ROUNDS ───
  if (snapshot.phase === "BETWEEN_ROUNDS") {
    const nextTeam = snapshot.teams.find((t) => t.id === snapshot.currentTeamId);
    const nextName =
      nextTeam?.players.find((p) => p.userId === snapshot.currentPlayerId)?.displayName ?? "?";
    return (
      <>
        <AppShell centered className="screen-anim">
          <div style={{ textAlign: "center" }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              следующий ход
            </div>
            <h1 className="h-display" style={{ marginBottom: 8 }}>
              {trio ? nextName : `Команда «${nextTeam?.name ?? "—"}»`}
            </h1>
            <p className="muted">
              {trio ? (
                <>
                  Объясняет <strong style={{ color: "var(--fg)" }}>{nextName}</strong> · угадывает{" "}
                  <strong style={{ color: "var(--fg)" }}>{guesserName}</strong>
                </>
              ) : (
                <>
                  Объясняет <strong style={{ color: "var(--fg)" }}>{nextName}</strong>
                </>
              )}
            </p>
            <p className="muted" style={{ marginTop: 18, fontSize: 13 }}>
              Раунд начнётся через несколько секунд…
            </p>
          </div>
        </AppShell>
        {modals}
      </>
    );
  }

  // ─── FINISHED ───
  // Раньше отсюда уводило на /alias/results/[gameId] — статическую страницу
  // без сокета. К моменту, когда человек видел счёт, комнаты для него уже не
  // было, и собрать всех на новую партию было не из чего.
  return (
    <>
      <AppShell centered className="screen-anim">
        {finalGame ? (
          <VictoryView
            game={finalGame}
            actions={
              <>
                <button type="button" className="btn btn-secondary btn-lg" onClick={onLeaveAfterGame}>
                  {isRoomHost ? <DoorClosed /> : <ArrowLeft />}
                  {isRoomHost ? "Закрыть комнату" : "Выйти"}
                </button>
                {isRoomHost ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    onClick={() => emit("room:restart", {}, () => {})}
                  >
                    <RefreshCw /> Сыграть ещё
                  </button>
                ) : (
                  <span className="muted" style={{ fontSize: 13, alignSelf: "center" }}>
                    Хост может собрать всех на новую партию
                  </span>
                )}
              </>
            }
          />
        ) : (
          <div style={{ textAlign: "center" }}>
            <h1 className="h-title" style={{ marginBottom: 8 }}>
              Игра окончена
            </h1>
            <p className="muted">Считаем итоги…</p>
          </div>
        )}
      </AppShell>
      {modals}
    </>
  );
}

// ─── Game top bar ───
function GameTop({
  role,
  trio,
  explainerName,
  guesserName,
  teamName,
  teamColor,
  roundNumber,
  onLeave,
  onEndGame,
  onPause,
}: {
  role: Role;
  trio: boolean;
  explainerName: string;
  guesserName: string;
  teamName: string;
  teamColor: string;
  roundNumber: number;
  /** Есть только у зрителя: игрок команды посреди партии не выходит. */
  onLeave: (() => void) | null;
  /** Есть только у хоста: оборвать партию, если ждать больше нечего. */
  onEndGame: (() => void) | null;
  onPause: () => void;
}) {
  return (
    <div className="game-top">
      {/* Выйти посреди партии может только зритель — состав команд заморожен,
          иначе ломается очередь объясняющих. У хоста вместо выхода рычаг
          «Завершить игру», у остальных тут пусто. */}
      {onLeave ? (
        <button type="button" className="back-link" onClick={onLeave}>
          <LogOut /> Выйти
        </button>
      ) : onEndGame ? (
        <button type="button" className="back-link" onClick={onEndGame}>
          <DoorClosed /> Завершить игру
        </button>
      ) : (
        <span />
      )}
      <div className="game-turn">
        <Avatar name={explainerName} color={teamColor} size={40} online={role !== "explainer"} />
        <div>
          <span className="gt-name">{role === "explainer" ? "Твой ход" : `${explainerName} объясняет`}</span>
          <span className="gt-team mono">
            {trio
              ? role === "spectator"
                ? `наблюдаешь · ${explainerName} → ${guesserName}`
                : `Угадывает ${guesserName} · круг ${roundNumber}`
              : role === "spectator"
                ? `наблюдаешь · «${teamName}»`
                : `Команда «${teamName}» · раунд ${roundNumber}`}
          </span>
        </div>
      </div>
      {role === "explainer" ? (
        <button type="button" className="icon-btn" onClick={onPause} aria-label="Пауза">
          <Pause />
        </button>
      ) : (
        <span className={"pill pill-mono" + (role === "spectator" ? "" : " pill-accent")}>
          {role === "spectator" ? (
            <>
              <EyeOff size={13} /> зритель
            </>
          ) : (
            <>
              <Users size={13} /> угадываешь
            </>
          )}
        </span>
      )}
    </div>
  );
}

// ─── Round review ───
function ReviewView({
  role,
  trio,
  pairName,
  review,
  penaltySkip,
  onToggle,
  onConfirm,
  isExplainer,
  nextExplainerOffline,
  nextExplainerName,
}: {
  role: Role;
  trio: boolean;
  /** Чей ход словами: втроём — пара, иначе — команда. */
  pairName: string;
  review: import("@alias/shared/domain").RoundReviewPayload | null;
  penaltySkip: boolean;
  onToggle: (wordId: number) => void;
  onConfirm: () => void;
  isExplainer: boolean;
  /** Следующий объясняющий не в сети — ход передавать некому. */
  nextExplainerOffline: boolean;
  nextExplainerName: string;
}) {
  if (!review) {
    return (
      <p className="muted" style={{ textAlign: "center" }}>
        Подсчитываем итоги…
      </p>
    );
  }
  const guessedCount = review.words.filter((w) => w.guessed).length;
  const skipped = review.words.filter((w) => !w.guessed).length;
  const score = guessedCount - (penaltySkip ? skipped : 0);

  return (
    <div className="summary-wrap">
      <div className="summary-left">
        <span className="eyebrow">итог раунда · {pairName}</span>
        <h1 className="h-display" style={{ margin: "12px 0" }}>
          {score > 0 ? "Отличный раунд!" : "Раунд завершён"}
        </h1>
        <p className="h-sub">
          {isExplainer
            ? "Тапни слово, чтобы переключить «угадано / пропуск», если где-то ошиблись."
            : trio
              ? `Итоги подтверждает объясняющий (ты — ${role === "guesser" ? "угадывал" : "наблюдатель"}).`
              : `Команда подтверждает итоги (ты — ${role === "guesser" ? "в команде" : "наблюдатель"}).`}
        </p>

        <div className="round-score">
          <div className="rs-big">
            <span
              className={"rs-plus mono" + (score >= 0 ? " accent-text" : "")}
              style={score < 0 ? { color: "var(--danger)" } : undefined}
            >
              {score > 0 ? "+" : ""}
              {score}
            </span>
            <span className="rs-l">очков за раунд</span>
          </div>
          <div className="rs-split">
            <div>
              <b className="mono accent-text">{guessedCount}</b> угадано
            </div>
            <div>
              <b className="mono">{skipped}</b> пропуск
            </div>
          </div>
        </div>

        {isExplainer ? (
          <>
            {/* Передать ход тому, кого нет в сети, нельзя: он его не увидит,
                и партия встала бы без объясняющего. Ждём его возвращения. */}
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              disabled={nextExplainerOffline}
              onClick={onConfirm}
            >
              Подтвердить · передать ход
            </button>
            {nextExplainerOffline && (
              <p className="muted" style={{ fontSize: 13, marginTop: 10, color: "var(--warn)" }}>
                {nextExplainerName} не в сети — ход передать пока нельзя. Ждём, когда
                вернётся.
              </p>
            )}
          </>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>
            Ждём, пока объясняющий подтвердит…
          </p>
        )}
      </div>

      <div className="card summary-words">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <h2 className="h-title">Слова раунда</h2>
          <span className="pill pill-mono">{pluralize(review.words.length, WORDS)}</span>
        </div>
        <div className="words-list">
          {review.words.map((w) => (
            <div
              key={w.wordId}
              className={"word-row " + (w.guessed ? "got" : "skip")}
              onClick={() => isExplainer && onToggle(w.wordId)}
              style={{ cursor: isExplainer ? "pointer" : "default" }}
            >
              <span className="wr-ic">{w.guessed ? <Check size={15} /> : <X size={15} />}</span>
              {w.text}
              <span className="wr-pts">{w.guessed ? "+1" : penaltySkip ? "−1" : "0"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
