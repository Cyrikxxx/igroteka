"use client";

// Игровой экран онлайн-режима. Три роли: explainer / guesser / spectator.
// См. DESIGN.md §5.6, PROMPT.md §2.4.

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RoomSnapshotTeam } from "@alias/shared/domain";
import { loadRoomCreds } from "@/lib/room-session";
import { useRoom } from "@/hooks/useRoom";
import Header from "@/components/ui/Header";
import Pill from "@/components/ui/Pill";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { formatTime } from "@/lib/utils";

interface Creds {
  code: string;
  wsUrl: string;
  wsToken: string;
  userId: string;
  displayName: string;
}

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const rawCode = (params.code as string).toUpperCase();
  const [creds, setCreds] = useState<Creds | null>(null);

  useEffect(() => {
    const stored = loadRoomCreds(rawCode);
    if (!stored) {
      router.replace(`/join?code=${rawCode}`);
      return;
    }
    setCreds(stored);
  }, [rawCode, router]);

  const opts = useMemo(
    () =>
      creds
        ? { wsUrl: creds.wsUrl, token: creds.wsToken, code: creds.code }
        : null,
    [creds],
  );
  const {
    socket,
    snapshot,
    countdown,
    tick,
    currentWord,
    wordCount,
    review,
    error,
    status,
  } = useRoom(opts);

  // Редирект назад в лобби, если игра ещё не началась
  useEffect(() => {
    if (!snapshot || !creds) return;
    if (snapshot.phase === "LOBBY") {
      router.replace(`/room/${creds.code}`);
    } else if (snapshot.phase === "FINISHED" && snapshot.gameId) {
      router.replace(`/results/${snapshot.gameId}`);
    }
  }, [snapshot?.phase, snapshot?.gameId, creds, router]);

  // ВНИМАНИЕ: все хуки должны быть до любых ранних `return`,
  // иначе при смене ветки рендера их количество меняется и React падает (ошибка #310).
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);

  // Закрываем модалку только когда сервер реально снял паузу (true → false).
  // Без этого эффект срабатывал бы сразу после нажатия «Пауза» —
  // флаг открытия уже стоит, а tick.paused ещё false (ответ от сервера в пути),
  // и условие выше закрывало модалку, которая только что открылась.
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
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p style={{ color: "var(--fg-2)" }}>
            {error ? `Ошибка: ${error}` : "Подключаемся…"}
          </p>
        </main>
      </div>
    );
  }

  const myTeam = snapshot.teams.find((t) =>
    t.players.some((p) => p.userId === creds.userId),
  );
  const activeTeam = snapshot.teams.find((t) => t.id === snapshot.currentTeamId);
  const isExplainer = snapshot.currentPlayerId === creds.userId;
  const isMyTeamActive = myTeam && myTeam.id === snapshot.currentTeamId;
  const role: "explainer" | "guesser" | "spectator" = isExplainer
    ? "explainer"
    : isMyTeamActive
    ? "guesser"
    : "spectator";

  const explainerPlayer = activeTeam?.players.find(
    (p) => p.userId === snapshot.currentPlayerId,
  );

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
  const onReviewToggle = (wordId: number) =>
    socket?.emit("round:review_toggle", { wordId }, () => {});
  const onReviewConfirm = () =>
    socket?.emit("round:review_confirm", {}, () => {});

  const canControlRound = role === "explainer" || creds.userId === snapshot.hostId;
  const showReconnectOverlay =
    status === "reconnecting" || (status === "error" && !!error);

  // Баннер хосту: объясняющий пропал посреди раунда.
  const explainerOffline =
    snapshot.phase === "ROUND_ACTIVE" &&
    explainerPlayer !== undefined &&
    !explainerPlayer.online;
  const showExplainerDropBanner =
    explainerOffline && creds.userId === snapshot.hostId;

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        right={
          <div className="flex items-center gap-2">
            {snapshot.phase === "ROUND_ACTIVE" && (
              <Pill tone="live">LIVE</Pill>
            )}
            <Pill mono>{creds.code}</Pill>
            <Pill mono style={{ color: "var(--accent)" }}>
              {status === "connected" ? "ONLINE" : status.toUpperCase()}
            </Pill>
          </div>
        }
      />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 md:px-8 py-6 flex flex-col">
        {showExplainerDropBanner && (
          <div
            className="mb-4 p-3 rounded-md flex items-center justify-between gap-3 flex-wrap"
            style={{
              background: "color-mix(in oklch, var(--warn) 14%, var(--bg-2))",
              border: "1px solid color-mix(in oklch, var(--warn) 35%, transparent)",
              color: "var(--warn)",
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">
                {explainerPlayer?.displayName ?? "Объясняющий"} отключился
              </div>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--fg-2)" }}
              >
                Можно подождать его реконнекта или завершить раунд досрочно.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={onEndRequest}
            >
              Завершить раунд
            </Button>
          </div>
        )}

        {/* Header bar */}
        <div className="flex items-center justify-between mb-6">
          <Pill
            style={
              activeTeam
                ? {
                    background: `color-mix(in oklch, var(${activeTeam.color}) 18%, var(--bg-2))`,
                    color: `var(${activeTeam.color})`,
                  }
                : undefined
            }
          >
            {activeTeam?.name ?? "—"} · {activeTeam?.score ?? 0}
          </Pill>
          <div className="eyebrow">РАУНД {snapshot.currentRoundNumber}</div>
          <div className="flex items-center gap-2">
            {wordCount && (
              <>
                <Pill mono style={{ color: "var(--accent)" }}>
                  +{wordCount.got}
                </Pill>
                <Pill mono style={{ color: "var(--danger)" }}>
                  -{wordCount.skip}
                </Pill>
              </>
            )}
          </div>
        </div>

        {/* Phase content */}
        {snapshot.phase === "PRE_ROUND" && (
          <PreRoundView
            countdown={countdown}
            activeTeam={activeTeam}
            explainerName={explainerPlayer?.displayName ?? "?"}
            role={role}
          />
        )}

        {snapshot.phase === "ROUND_ACTIVE" && (
          <ActiveRoundView
            role={role}
            tick={tick}
            durationSec={snapshot.settings.roundTime}
            currentWord={currentWord}
            explainerName={explainerPlayer?.displayName ?? "?"}
            teamColor={activeTeam?.color ?? "--team-1"}
            onGuess={onGuess}
            onPause={onPause}
            onResume={onResume}
            onEnd={onEndRequest}
          />
        )}

        {snapshot.phase === "ROUND_REVIEW" && (
          <ReviewView
            role={role}
            review={review}
            penaltySkip={snapshot.settings.penaltySkip}
            onToggle={onReviewToggle}
            onConfirm={onReviewConfirm}
            isExplainer={isExplainer}
          />
        )}

        {snapshot.phase === "BETWEEN_ROUNDS" && (
          <BetweenRoundsView
            nextTeam={snapshot.teams.find((t) => t.id === snapshot.currentTeamId)}
            nextExplainerName={
              snapshot.teams
                .find((t) => t.id === snapshot.currentTeamId)
                ?.players.find((p) => p.userId === snapshot.currentPlayerId)
                ?.displayName ?? "?"
            }
          />
        )}

        {snapshot.phase === "FINISHED" && (
          <div className="text-center py-12">
            <p className="h-title mb-2">Игра окончена</p>
            <p style={{ color: "var(--fg-2)" }}>Переходим к результатам…</p>
          </div>
        )}
      </main>

      {/* ───────── Pause modal ───────── */}
      <Modal
        isOpen={pauseModalOpen && canControlRound}
        title="Пауза"
        onClose={onResume}
      >
        <p className="text-sm mb-5" style={{ color: "var(--fg-2)" }}>
          Раунд приостановлен. Таймер не идёт, пока модалка открыта.
        </p>
        <div className="flex flex-col gap-2">
          <Button block size="lg" onClick={onResume}>
            Продолжить
          </Button>
          <Button block size="md" variant="danger" onClick={onEndRequest}>
            Завершить раунд
          </Button>
        </div>
        {wordCount && (
          <div
            className="mt-5 pt-4 flex justify-center gap-4 text-xs"
            style={{ borderTop: "1px dashed var(--line-strong)", color: "var(--fg-2)" }}
          >
            <span>
              <span className="font-mono font-bold" style={{ color: "var(--accent)" }}>
                +{wordCount.got}
              </span>{" "}
              угадано
            </span>
            {tick && (
              <span>
                <span className="font-mono font-bold">{formatTime(Math.ceil(tick.msLeft / 1000))}</span>{" "}
                осталось
              </span>
            )}
          </div>
        )}
      </Modal>

      {/* ───────── End round confirm ───────── */}
      <Modal
        isOpen={endConfirmOpen}
        title="Завершить раунд?"
        onClose={() => setEndConfirmOpen(false)}
      >
        <p className="text-sm mb-5" style={{ color: "var(--fg-2)" }}>
          Раунд будет засчитан с текущим счётом. Передадим ход следующей команде.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="md"
            className="flex-1"
            onClick={() => setEndConfirmOpen(false)}
          >
            Отмена
          </Button>
          <Button variant="danger" size="md" className="flex-1" onClick={onEndConfirm}>
            Да, завершить
          </Button>
        </div>
      </Modal>

      {/* ───────── Reconnect overlay ───────── */}
      <Modal isOpen={showReconnectOverlay} fullscreen>
        <div className="text-center py-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span
              className="pulse inline-block w-2 h-2 rounded-full"
              style={{ background: "var(--warn)" }}
            />
            <span
              className="font-mono text-[11px] uppercase"
              style={{ letterSpacing: "0.18em", color: "var(--warn)" }}
            >
              Соединение потеряно
            </span>
          </div>
          <h2 className="h-title mb-2">Переподключаемся…</h2>
          <p className="text-sm" style={{ color: "var(--fg-2)" }}>
            {status === "reconnecting"
              ? "Сервер не отвечает. Пытаемся подключиться заново."
              : error ?? "Что-то пошло не так."}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-6"
            onClick={() => router.push("/")}
          >
            На главную
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Pre-round countdown ─────────────────────────────────────────────────

function PreRoundView({
  countdown,
  activeTeam,
  explainerName,
  role,
}: {
  countdown: number | null;
  activeTeam: RoomSnapshotTeam | undefined;
  explainerName: string;
  role: "explainer" | "guesser" | "spectator";
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <div className="eyebrow mb-4">
        КОМАНДА «{activeTeam?.name ?? "—"}» · ОБЪЯСНЯЕТ {explainerName.toUpperCase()}
      </div>
      <div
        className="font-mono font-extrabold tabular-nums"
        style={{
          fontSize: "clamp(96px, 22vw, 200px)",
          color:
            countdown && countdown <= 1 ? "var(--danger)" : "var(--accent)",
          letterSpacing: "-0.04em",
          lineHeight: 1,
        }}
      >
        {countdown ?? "—"}
      </div>
      <p className="mt-6 text-sm" style={{ color: "var(--fg-2)" }}>
        {role === "explainer"
          ? "Приготовьтесь! Сейчас покажем слово."
          : role === "guesser"
          ? "Слушайте и угадывайте."
          : "Смотрите."}
      </p>
    </div>
  );
}

// ─── Active round ────────────────────────────────────────────────────────

function ActiveRoundView({
  role,
  tick,
  durationSec,
  currentWord,
  explainerName,
  teamColor,
  onGuess,
  onPause,
  onResume,
  onEnd,
}: {
  role: "explainer" | "guesser" | "spectator";
  tick: { msLeft: number; paused: boolean } | null;
  durationSec: number;
  currentWord: { wordId: number; text: string } | null;
  explainerName: string;
  teamColor: string;
  onGuess: (guessed: boolean) => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}) {
  const sec = Math.max(0, Math.ceil((tick?.msLeft ?? 0) / 1000));
  const ratio = Math.max(0, Math.min(1, (tick?.msLeft ?? 0) / (durationSec * 1000)));
  const lowTime = sec <= 5;

  return (
    <div className="flex-1 flex flex-col items-center justify-between gap-6">
      {/* Timer */}
      <div className="text-center">
        <div
          className="font-mono font-extrabold tabular-nums"
          style={{
            fontSize: "clamp(64px, 14vw, 96px)",
            color: lowTime ? "var(--danger)" : "var(--fg)",
            letterSpacing: "-0.04em",
          }}
        >
          {formatTime(sec)}
        </div>
        <div
          className="mx-auto mt-2 h-1 rounded-full overflow-hidden"
          style={{ width: 240, background: "var(--bg-3)" }}
        >
          <div
            className="h-full transition-[width] duration-300"
            style={{
              width: `${ratio * 100}%`,
              background: lowTime ? "var(--danger)" : "var(--accent)",
            }}
          />
        </div>
        {tick?.paused && (
          <p className="mt-2 text-sm" style={{ color: "var(--warn)" }}>
            пауза
          </p>
        )}
      </div>

      {/* Center: word or spectator card */}
      <div className="flex-1 w-full max-w-xl flex items-center justify-center">
        {role === "explainer" ? (
          currentWord ? (
            <div
              key={currentWord.wordId}
              className="w-full rounded-2xl px-8 py-16 text-center relative"
              style={{
                background: "var(--bg-1)",
                border: "2px solid var(--accent-line)",
                boxShadow:
                  "0 0 0 1px var(--accent-soft), 0 24px 60px rgba(0,0,0,0.35)",
              }}
            >
              <div className="eyebrow mb-3">СЛОВО</div>
              <div
                className="font-extrabold leading-none"
                style={{
                  fontSize: "clamp(36px, 8vw, 56px)",
                  letterSpacing: "-0.02em",
                }}
              >
                {currentWord.text}
              </div>
            </div>
          ) : (
            <p style={{ color: "var(--fg-2)" }}>Жду слово…</p>
          )
        ) : (
          <Card className="w-full text-center max-w-md">
            <div className="eyebrow mb-3">
              {role === "guesser" ? "ВЫ УГАДЫВАЕТЕ" : "ВЫ СМОТРИТЕ"}
            </div>
            <div
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl font-extrabold mb-3"
              style={{
                background: `color-mix(in oklch, var(${teamColor}) 25%, var(--bg-2))`,
                color: `var(${teamColor})`,
              }}
            >
              {explainerName.charAt(0).toUpperCase()}
            </div>
            <div className="text-2xl font-extrabold tracking-tight">
              {explainerName} объясняет
            </div>
            <div className="text-sm mt-1" style={{ color: "var(--fg-2)" }}>
              {role === "guesser" ? "Слушайте и угадывайте" : "Смотрите за раундом"}
            </div>
          </Card>
        )}
      </div>

      {/* Bottom: actions */}
      <div className="w-full max-w-xl">
        {role === "explainer" ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onGuess(false)}
              disabled={!currentWord || tick?.paused}
              className="h-[72px] rounded-xl font-extrabold text-base transition-transform active:translate-y-px disabled:opacity-50"
              style={{ background: "oklch(0.55 0.20 25)", color: "#fff" }}
            >
              ✕ Пропуск
            </button>
            <button
              type="button"
              onClick={() => onGuess(true)}
              disabled={!currentWord || tick?.paused}
              className="h-[72px] rounded-xl font-extrabold text-base transition-transform active:translate-y-px disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
            >
              ✓ Угадал
            </button>
            <div className="col-span-2 flex justify-center gap-2 mt-2">
              {tick?.paused ? (
                <Button variant="secondary" size="sm" onClick={onResume}>
                  Продолжить
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={onPause}>
                  Пауза
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onEnd}>
                Завершить раунд
              </Button>
            </div>
          </div>
        ) : (
          <p
            className="text-center text-sm"
            style={{ color: "var(--fg-3)" }}
          >
            {role === "guesser"
              ? "Ваши очки появятся, когда объясняющий нажмёт «Угадал»."
              : "Раунд идёт. Дождитесь итогов."}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Round review ────────────────────────────────────────────────────────

function ReviewView({
  role,
  review,
  penaltySkip,
  onToggle,
  onConfirm,
  isExplainer,
}: {
  role: "explainer" | "guesser" | "spectator";
  review: import("@alias/shared/domain").RoundReviewPayload | null;
  penaltySkip: boolean;
  onToggle: (wordId: number) => void;
  onConfirm: () => void;
  isExplainer: boolean;
}) {
  if (!review) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p style={{ color: "var(--fg-2)" }}>Подсчитываем итоги…</p>
      </div>
    );
  }
  const guessedCount = review.words.filter((w) => w.guessed).length;
  const skipped = review.words.filter((w) => !w.guessed).length;
  const score = guessedCount - (penaltySkip ? skipped : 0);

  return (
    <div className="w-full">
      <div className="eyebrow mb-2">ИТОГИ РАУНДА</div>
      <p className="text-sm mb-4" style={{ color: "var(--fg-2)" }}>
        {isExplainer
          ? "Нажмите на слово, чтобы изменить статус."
          : `Команда подтверждает итоги (вы — ${role === "guesser" ? "в команде" : "наблюдатель"}).`}
      </p>

      <ul className="flex flex-col gap-2 mb-4 max-h-[50vh] overflow-y-auto">
        {review.words.map((w) => (
          <li key={w.wordId}>
            <button
              type="button"
              onClick={() => isExplainer && onToggle(w.wordId)}
              disabled={!isExplainer}
              className="w-full text-left px-4 py-3 rounded-md flex items-center gap-3"
              style={
                w.guessed
                  ? {
                      background:
                        "color-mix(in oklch, var(--accent) 10%, var(--bg-1))",
                      border: "1px solid var(--accent-line)",
                      color: "var(--accent)",
                      cursor: isExplainer ? "pointer" : "default",
                    }
                  : {
                      background:
                        "color-mix(in oklch, var(--danger) 10%, var(--bg-1))",
                      border:
                        "1px solid color-mix(in oklch, var(--danger) 30%, transparent)",
                      color: "var(--danger)",
                      cursor: isExplainer ? "pointer" : "default",
                    }
              }
            >
              <span className="text-lg leading-none">{w.guessed ? "✓" : "×"}</span>
              <span className="flex-1 font-medium">{w.text}</span>
              <span className="font-mono text-xs opacity-80">
                {w.guessed ? "+1" : penaltySkip ? "−1" : "0"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Card className="mb-4">
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: "var(--fg-2)" }}>Угадано</span>
          <span className="font-bold" style={{ color: "var(--accent)" }}>
            +{guessedCount}
          </span>
        </div>
        {skipped > 0 && (
          <div className="flex items-center justify-between text-sm mt-1">
            <span style={{ color: "var(--fg-2)" }}>Пропущено</span>
            <span style={{ color: penaltySkip ? "var(--danger)" : "var(--fg-2)" }}>
              {penaltySkip ? `−${skipped}` : `${skipped} (без штрафа)`}
            </span>
          </div>
        )}
        <div
          className="flex items-center justify-between mt-3 pt-3 text-base font-bold"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <span>Итого за раунд</span>
          <span style={{ color: score >= 0 ? "var(--accent)" : "var(--danger)" }}>
            {score > 0 ? "+" : ""}
            {score}
          </span>
        </div>
      </Card>

      {isExplainer ? (
        <Button block size="lg" onClick={onConfirm}>
          Подтвердить и передать ход
        </Button>
      ) : (
        <p className="text-center text-sm" style={{ color: "var(--fg-3)" }}>
          Ждём, пока объясняющий подтвердит…
        </p>
      )}
    </div>
  );
}

// ─── Between rounds ──────────────────────────────────────────────────────

function BetweenRoundsView({
  nextTeam,
  nextExplainerName,
}: {
  nextTeam: RoomSnapshotTeam | undefined;
  nextExplainerName: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <div className="eyebrow mb-3">СЛЕДУЮЩИЙ ХОД</div>
      <div className="h-display mb-2">
        Команда «{nextTeam?.name ?? "—"}»
      </div>
      <p style={{ color: "var(--fg-2)" }}>
        Объясняет <strong style={{ color: "var(--fg)" }}>{nextExplainerName}</strong>
      </p>
      <p className="mt-6 text-sm" style={{ color: "var(--fg-3)" }}>
        Раунд начнётся через несколько секунд…
      </p>
    </div>
  );
}
