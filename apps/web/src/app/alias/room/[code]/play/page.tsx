"use client";

// Игровой экран онлайн-режима. Три роли: explainer / guesser / spectator.
// Дизайн — GameScreen / RoundSummary из редизайна. Вся realtime-логика
// (useRoom, фазы, socket.emit, приватность роли, модалки) сохранена.

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Clock, EyeOff, LogOut, Pause, SkipForward, Users, X } from "lucide-react";
import { loadRoomCreds } from "@/lib/room-session";
import { useRoom } from "@/hooks/useRoom";
import { pluralize, WORDS } from "@/lib/plural";
import AppShell from "@/components/common/AppShell";
import Avatar from "@/components/common/Avatar";
import Modal from "@/components/common/Modal";
import TimerRing from "@/components/alias/game/TimerRing";

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
  const [creds, setCreds] = useState<Creds | null>(null);

  useEffect(() => {
    const stored = loadRoomCreds(rawCode);
    if (!stored) {
      router.replace(`/alias/join?code=${rawCode}`);
      return;
    }
    setCreds(stored);
  }, [rawCode, router]);

  const opts = useMemo(
    () => (creds ? { wsUrl: creds.wsUrl, token: creds.wsToken, code: creds.code } : null),
    [creds],
  );
  const { socket, snapshot, tick, currentWord, wordCount, review, error, status } =
    useRoom(opts);

  // Редирект назад в лобби, если игра ещё не началась
  useEffect(() => {
    if (!snapshot || !creds) return;
    if (snapshot.phase === "LOBBY") {
      router.replace(`/alias/room/${creds.code}`);
    } else if (snapshot.phase === "FINISHED" && snapshot.gameId) {
      router.replace(`/alias/results/${snapshot.gameId}`);
    }
  }, [snapshot?.phase, snapshot?.gameId, creds, router]);

  // ВНИМАНИЕ: все хуки должны быть до любых ранних return.
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);

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
  const role: Role = isExplainer ? "explainer" : isMyTeamActive ? "guesser" : "spectator";
  const explainerPlayer = activeTeam?.players.find((p) => p.userId === snapshot.currentPlayerId);

  const onGuess = (guessed: boolean) => {
    if (!currentWord) return;
    socket?.emit("round:guess", { wordId: currentWord.wordId, guessed }, () => {});
  };
  const onPause = () => {
    socket?.emit("round:pause", {}, () => {});
    setPauseModalOpen(true);
  };
  const onResume = () => {
    socket?.emit("round:resume", {}, () => {});
    setPauseModalOpen(false);
  };
  const onEndRequest = () => setEndConfirmOpen(true);
  const onEndConfirm = () => {
    socket?.emit("round:end", { confirm: true }, () => {});
    setEndConfirmOpen(false);
    setPauseModalOpen(false);
  };
  const onReviewToggle = (wordId: number) => socket?.emit("round:review_toggle", { wordId }, () => {});
  const onReviewConfirm = () => socket?.emit("round:review_confirm", {}, () => {});
  // Раньше «Выйти» просто уводило на хаб, не спросив и не сказав серверу:
  // игрок оставался в комнате и висел в составе команды.
  const onLeave = () => {
    if (!window.confirm("Выйти из комнаты? Вернуться можно будет по тому же коду.")) return;
    socket?.emit("room:leave", {}, () => {});
    router.push("/alias");
  };

  const canControlRound = role === "explainer" || creds.userId === snapshot.hostId;
  const showReconnectOverlay = status === "reconnecting" || (status === "error" && !!error);
  const explainerOffline =
    snapshot.phase === "ROUND_ACTIVE" && explainerPlayer !== undefined && !explainerPlayer.online;
  const showExplainerDropBanner = explainerOffline && creds.userId === snapshot.hostId;

  const teamColor = activeTeam?.color ?? "--team-1";
  const teamName = activeTeam?.name ?? "—";
  const explainerName = explainerPlayer?.displayName ?? "?";
  const roundTime = snapshot.settings.roundTime;
  const sec = Math.max(0, Math.ceil((tick?.msLeft ?? 0) / 1000));
  const danger = snapshot.phase === "ROUND_ACTIVE" && sec <= 10;
  const got = wordCount?.got ?? 0;
  const skip = wordCount?.skip ?? 0;

  const statusRight = <StatusPills code={creds.code} status={status} live={snapshot.phase === "ROUND_ACTIVE"} />;

  const modals = (
    <>
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
        <AppShell noHeader bare>
          <div className={"game-screen" + (danger ? " danger" : "")}>
            <div className="game-bg" />
            <div className="shell game-shell">
              <GameTop
                role={role}
                explainerName={explainerName}
                teamName={teamName}
                teamColor={teamColor}
                roundNumber={snapshot.currentRoundNumber}
                onLeave={onLeave}
                onPause={onPause}
              />

              {showExplainerDropBanner && (
                <div className="notice notice-warn" style={{ margin: "0 0 12px" }}>
                  <div className="row-between" style={{ gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--warn)" }}>
                        {explainerName} отключился
                      </div>
                      <p className="muted" style={{ fontSize: 12, margin: "2px 0 0" }}>
                        Можно подождать реконнекта или завершить раунд досрочно.
                      </p>
                    </div>
                    <button type="button" className="btn btn-danger btn-sm" onClick={onEndRequest}>
                      Завершить раунд
                    </button>
                  </div>
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
        <AppShell centered right={statusRight} className="screen-anim">
          <ReviewView
            role={role}
            review={review}
            penaltySkip={snapshot.settings.penaltySkip}
            teamName={teamName}
            onToggle={onReviewToggle}
            onConfirm={onReviewConfirm}
            isExplainer={isExplainer}
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
        <AppShell centered right={statusRight} className="screen-anim">
          <div style={{ textAlign: "center" }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              следующий ход
            </div>
            <h1 className="h-display" style={{ marginBottom: 8 }}>
              Команда «{nextTeam?.name ?? "—"}»
            </h1>
            <p className="muted">
              Объясняет <strong style={{ color: "var(--fg)" }}>{nextName}</strong>
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
  return (
    <>
      <AppShell centered right={statusRight}>
        <div style={{ textAlign: "center" }}>
          <h1 className="h-title" style={{ marginBottom: 8 }}>
            Игра окончена
          </h1>
          <p className="muted">Переходим к результатам…</p>
        </div>
      </AppShell>
      {modals}
    </>
  );
}

// ─── Game top bar ───
function GameTop({
  role,
  explainerName,
  teamName,
  teamColor,
  roundNumber,
  onLeave,
  onPause,
}: {
  role: Role;
  explainerName: string;
  teamName: string;
  teamColor: string;
  roundNumber: number;
  onLeave: () => void;
  onPause: () => void;
}) {
  return (
    <div className="game-top">
      <button type="button" className="back-link" onClick={onLeave}>
        <LogOut /> Выйти
      </button>
      <div className="game-turn">
        <Avatar name={explainerName} color={teamColor} size={40} online={role !== "explainer"} />
        <div>
          <span className="gt-name">{role === "explainer" ? "Твой ход" : `${explainerName} объясняет`}</span>
          <span className="gt-team mono">
            {role === "spectator"
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

// ─── Status pills (centered screens) ───
function StatusPills({ code, status, live }: { code: string; status: string; live: boolean }) {
  const color =
    status === "connected"
      ? "var(--accent)"
      : status === "reconnecting" || status === "connecting"
        ? "var(--warn)"
        : "var(--danger)";
  return (
    <div className="row" style={{ gap: 8 }}>
      {live && (
        <span className="pill pill-live">
          <span className="dot dot-pulse" /> LIVE
        </span>
      )}
      <span className="pill pill-mono">{code}</span>
      <span className="pill pill-mono" style={{ color }}>
        <span className="dot" style={{ color }} />
        {status === "connected" ? "ONLINE" : status.toUpperCase()}
      </span>
    </div>
  );
}

// ─── Round review ───
function ReviewView({
  role,
  review,
  penaltySkip,
  teamName,
  onToggle,
  onConfirm,
  isExplainer,
}: {
  role: Role;
  review: import("@alias/shared/domain").RoundReviewPayload | null;
  penaltySkip: boolean;
  teamName: string;
  onToggle: (wordId: number) => void;
  onConfirm: () => void;
  isExplainer: boolean;
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
        <span className="eyebrow">итог раунда · команда «{teamName}»</span>
        <h1 className="h-display" style={{ margin: "12px 0" }}>
          {score > 0 ? "Отличный раунд!" : "Раунд завершён"}
        </h1>
        <p className="h-sub">
          {isExplainer
            ? "Тапни слово, чтобы переключить «угадано / пропуск», если где-то ошиблись."
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
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onConfirm}>
            Подтвердить · передать ход
          </button>
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
