"use client";

// Лобби онлайн-комнаты. См. DESIGN.md §5.3.
// Кнопка «Начать игру» пока заблокирована — игровой цикл онлайн будет
// в следующей сессии (2.4).

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RoomSnapshot, RoomSnapshotTeam } from "@alias/shared/domain";
import {
  MAX_TEAMS,
  MAX_PLAYERS_PER_TEAM,
  MIN_TEAMS,
  MIN_PLAYERS_PER_TEAM,
} from "@/constants/game";
import { loadRoomCreds, clearRoomCreds } from "@/lib/room-session";
import { useRoom } from "@/hooks/useRoom";
import Header from "@/components/ui/Header";
import Card from "@/components/ui/Card";
import Pill from "@/components/ui/Pill";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

interface Creds {
  code: string;
  wsUrl: string;
  wsToken: string;
  userId: string;
  displayName: string;
}

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const rawCode = (params.code as string).toUpperCase();
  const [creds, setCreds] = useState<Creds | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = loadRoomCreds(rawCode);
    if (!stored) {
      router.replace(`/join?code=${rawCode}`);
      return;
    }
    setCreds(stored);
    setMounted(true);
  }, [rawCode, router]);

  const roomOpts = useMemo(
    () =>
      creds
        ? { wsUrl: creds.wsUrl, token: creds.wsToken, code: creds.code }
        : null,
    [creds],
  );
  const { socket, snapshot, status, error } = useRoom(roomOpts);

  // Авто-редирект на игровой экран при старте игры.
  useEffect(() => {
    if (!snapshot || !creds) return;
    if (
      snapshot.phase === "PRE_ROUND" ||
      snapshot.phase === "ROUND_ACTIVE" ||
      snapshot.phase === "ROUND_REVIEW" ||
      snapshot.phase === "BETWEEN_ROUNDS"
    ) {
      router.replace(`/room/${creds.code}/play`);
    } else if (snapshot.phase === "FINISHED" && snapshot.gameId) {
      router.replace(`/results/${snapshot.gameId}`);
    }
  }, [snapshot?.phase, snapshot?.gameId, creds, router]);

  if (!mounted || !creds) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p style={{ color: "var(--fg-2)" }}>Загрузка…</p>
        </main>
      </div>
    );
  }

  const isHost = snapshot?.hostId === creds.userId;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(creds.code);
    } catch {}
  };
  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/join?code=${creds.code}`;
      await navigator.clipboard.writeText(url);
    } catch {}
  };
  const handleLeave = async () => {
    socket?.emit("room:leave", {}, () => {});
    clearRoomCreds(creds.code);
    router.push("/");
  };
  const handleCloseRoom = async () => {
    if (!confirm("Закрыть комнату для всех?")) return;
    await fetch(`/api/rooms/${creds.code}`, { method: "DELETE" }).catch(() => {});
    clearRoomCreds(creds.code);
    router.push("/");
  };

  const createTeam = () => socket?.emit("team:create", {}, () => {});
  const renameTeam = (teamId: number, name: string) =>
    socket?.emit("team:rename", { teamId, name }, () => {});
  const removeTeam = (teamId: number) => {
    if (!confirm("Удалить команду? Игроки уедут в зрители.")) return;
    socket?.emit("team:remove", { teamId }, () => {});
  };
  const joinTeam = (teamId: number | null) =>
    socket?.emit("team:join", { teamId }, () => {});

  const myTeam = snapshot?.teams.find((t) =>
    t.players.some((p) => p.userId === creds.userId),
  );

  const playersTotal =
    (snapshot?.teams.reduce((s, t) => s + t.players.length, 0) ?? 0);
  const spectatorsTotal = snapshot?.spectators.length ?? 0;

  // Условия для старта (UI-валидация, кнопка пока всё равно заблокирована).
  const teamsCount = snapshot?.teams.length ?? 0;
  const allTeamsHaveEnoughOnline =
    teamsCount >= MIN_TEAMS &&
    (snapshot?.teams ?? []).every(
      (t) => t.players.filter((p) => p.online).length >= MIN_PLAYERS_PER_TEAM,
    );

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        right={
          <div className="flex items-center gap-2">
            <Pill tone="live">LIVE</Pill>
            <Pill mono>{creds.code}</Pill>
            <ConnIndicator status={status} />
          </div>
        }
      />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 md:px-8 py-8">
        <div className="eyebrow mb-2">ONLINE LOBBY · WAITING ROOM</div>
        <h1 className="h-title mb-1">
          {snapshot?.title || "Игра без названия"}
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--fg-2)" }}>
          {snapshot
            ? `${playersTotal} игрок${plural(playersTotal)}, ${spectatorsTotal} зрител${pluralZ(spectatorsTotal)}`
            : "Подключаемся…"}
        </p>

        {error && (
          <div
            className="mb-6 p-3 rounded-md text-sm"
            style={{
              background: "color-mix(in oklch, var(--danger) 12%, var(--bg-2))",
              color: "var(--danger)",
              border: "1px solid color-mix(in oklch, var(--danger) 30%, transparent)",
            }}
          >
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-[1fr_320px] gap-6">
          {/* Левая колонка — команды */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">
                Команды {teamsCount}/{MAX_TEAMS}
              </h2>
            </div>

            {snapshot?.teams.length === 0 && (
              <Card flat dashed className="text-center mb-3">
                <p className="text-sm" style={{ color: "var(--fg-2)" }}>
                  Команд пока нет. {isHost ? "Создайте первую." : "Подождите хоста."}
                </p>
              </Card>
            )}

            <div className="grid gap-3 md:grid-cols-2 mb-3">
              {snapshot?.teams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  currentUserId={creds.userId}
                  hostId={snapshot.hostId}
                  isHost={isHost}
                  onRename={(name) => renameTeam(team.id, name)}
                  onRemove={() => removeTeam(team.id)}
                  onJoin={() => joinTeam(team.id)}
                />
              ))}
              {isHost && teamsCount < MAX_TEAMS && (
                <button
                  type="button"
                  onClick={createTeam}
                  className="rounded-[var(--card-r)] p-6 text-sm font-semibold flex items-center justify-center min-h-[160px]"
                  style={{
                    background: "transparent",
                    border: "1px dashed var(--line-strong)",
                    color: "var(--fg-2)",
                  }}
                >
                  + Создать команду
                </button>
              )}
            </div>

            {/* Зрители */}
            <Card className="mb-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold">
                  Зрители ({snapshot?.spectators.length ?? 0})
                </h3>
                {myTeam && (
                  <button
                    type="button"
                    onClick={() => joinTeam(null)}
                    className="text-xs underline"
                    style={{ color: "var(--fg-2)" }}
                  >
                    выйти в зрители
                  </button>
                )}
              </div>
              {snapshot?.spectators.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--fg-3)" }}>
                  никого
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {snapshot?.spectators.map((s) => (
                    <li key={s.userId}>
                      <Pill
                        style={{
                          background: s.online
                            ? "var(--bg-3)"
                            : "var(--bg-2)",
                          color: s.online ? "var(--fg-1)" : "var(--fg-3)",
                        }}
                      >
                        {s.online && (
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full"
                            style={{ background: "var(--accent)" }}
                          />
                        )}
                        {s.displayName}
                        {s.userId === snapshot.hostId && " 👑"}
                      </Pill>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          {/* Правая колонка — host panel или player view */}
          <aside className="flex flex-col gap-3">
            <Card>
              <div className="eyebrow mb-2">КОД КОМНАТЫ</div>
              <div
                className="font-mono font-extrabold tabular-nums text-center my-2"
                style={{
                  fontSize: 32,
                  letterSpacing: "0.15em",
                  color: "var(--accent)",
                }}
              >
                {creds.code}
              </div>
              <div className="flex flex-col gap-2 mt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  block
                  onClick={handleCopyCode}
                >
                  Копировать код
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  block
                  onClick={handleCopyLink}
                >
                  Копировать ссылку
                </Button>
              </div>
            </Card>

            <Card>
              <div className="eyebrow mb-2">НАСТРОЙКИ</div>
              <dl className="text-sm flex flex-col gap-1">
                <Row label="Время раунда" value={`${snapshot?.settings.roundTime ?? "—"} сек`} />
                <Row label="До победы" value={`${snapshot?.settings.winScore ?? "—"} очков`} />
                <Row
                  label="Штраф за пропуск"
                  value={snapshot?.settings.penaltySkip ? "да" : "нет"}
                />
                <Row
                  label="Категорий"
                  value={String(snapshot?.settings.categoryIds.length ?? 0)}
                />
              </dl>
            </Card>

            {isHost ? (
              <>
                <Button
                  size="lg"
                  block
                  disabled={!allTeamsHaveEnoughOnline}
                  onClick={() => {
                    socket?.emit("round:start_game", {}, (resp: unknown) => {
                      if (
                        resp &&
                        typeof resp === "object" &&
                        "error" in (resp as Record<string, unknown>)
                      ) {
                        alert(`Не удалось стартовать: ${(resp as { error: string }).error}`);
                      }
                    });
                  }}
                >
                  Начать игру
                </Button>
                <p
                  className="text-xs text-center"
                  style={{ color: "var(--fg-3)" }}
                >
                  {allTeamsHaveEnoughOnline
                    ? `Готово к старту`
                    : `Нужно ≥${MIN_TEAMS} команды, в каждой ≥${MIN_PLAYERS_PER_TEAM} игрока онлайн`}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseRoom}
                >
                  Закрыть комнату
                </Button>
              </>
            ) : (
              <Card className="text-center">
                <div className="eyebrow mb-2">ВЫ ПОДКЛЮЧЕНЫ</div>
                <p className="text-sm" style={{ color: "var(--fg-2)" }}>
                  Хост скоро начнёт игру
                </p>
              </Card>
            )}
            <Button variant="ghost" size="sm" onClick={handleLeave}>
              Выйти из комнаты
            </Button>
          </aside>
        </div>
      </main>

      {/* Reconnect overlay */}
      <Modal
        isOpen={status === "reconnecting" || (status === "error" && !!error)}
        fullscreen
      >
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

function TeamCard({
  team,
  currentUserId,
  hostId,
  isHost,
  onRename,
  onRemove,
  onJoin,
}: {
  team: RoomSnapshotTeam;
  currentUserId: string;
  hostId: string;
  isHost: boolean;
  onRename: (name: string) => void;
  onRemove: () => void;
  onJoin: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(team.name);
  const meIsHere = team.players.some((p) => p.userId === currentUserId);
  const canJoin = !meIsHere && team.players.length < MAX_PLAYERS_PER_TEAM;

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== team.name) onRename(next);
    else setDraft(team.name);
  };

  return (
    <Card
      style={{
        background: `linear-gradient(180deg, color-mix(in oklch, var(${team.color}) 12%, var(--bg-1)), var(--bg-1))`,
        borderColor: `color-mix(in oklch, var(${team.color}) 30%, var(--line-strong))`,
      }}
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        {editing ? (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 30))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(team.name);
                setEditing(false);
              }
            }}
            autoFocus
            style={{ fontWeight: 800, color: `var(${team.color})` }}
          />
        ) : (
          <button
            type="button"
            disabled={!isHost}
            onClick={() => isHost && setEditing(true)}
            className="font-extrabold text-lg tracking-tight text-left"
            style={{ color: `var(${team.color})`, cursor: isHost ? "text" : "default" }}
            title={isHost ? "Кликни, чтобы переименовать" : ""}
          >
            {team.name}
          </button>
        )}
        <div className="flex items-center gap-2 shrink-0">
          <Pill mono>
            {team.players.length}/{MAX_PLAYERS_PER_TEAM}
          </Pill>
          {isHost && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Удалить команду"
              className="text-xs underline"
              style={{ color: "var(--fg-3)" }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <ul className="flex flex-col gap-2 mb-3">
        {team.players.length === 0 ? (
          <li
            className="text-xs px-3 py-3 rounded-md text-center"
            style={{
              color: "var(--fg-3)",
              background: "var(--bg-2)",
              border: "1px dashed var(--line)",
            }}
          >
            пока пусто
          </li>
        ) : (
          team.players.map((p) => {
            const isMe = p.userId === currentUserId;
            const isCrown = p.userId === hostId;
            return (
              <li
                key={p.userId}
                className="flex items-center gap-3 px-3 py-2 rounded-md"
                style={{
                  background: isMe
                    ? `color-mix(in oklch, var(${team.color}) 18%, var(--bg-2))`
                    : "var(--bg-2)",
                  border: isMe
                    ? `1px solid color-mix(in oklch, var(${team.color}) 45%, transparent)`
                    : "1px solid var(--line)",
                  opacity: p.online ? 1 : 0.55,
                }}
              >
                {/* Avatar with team-color accent */}
                <span className="relative shrink-0">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold"
                    style={{
                      background: `color-mix(in oklch, var(${team.color}) 35%, var(--bg-3))`,
                      color: `var(${team.color})`,
                    }}
                  >
                    {(p.displayName || "?").charAt(0).toUpperCase()}
                  </span>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                    style={{
                      background: p.online ? "var(--accent)" : "var(--fg-4)",
                      border: "2px solid var(--bg-1)",
                    }}
                  />
                </span>

                <span
                  className="flex-1 min-w-0 font-semibold text-sm truncate"
                  style={{ color: "var(--fg)" }}
                >
                  {p.displayName}
                  {isCrown && (
                    <span className="ml-1.5" title="Хост">
                      👑
                    </span>
                  )}
                </span>

                {isMe && (
                  <span
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      background: `color-mix(in oklch, var(${team.color}) 30%, var(--bg-3))`,
                      color: `var(${team.color})`,
                    }}
                  >
                    ВЫ
                  </span>
                )}
              </li>
            );
          })
        )}
      </ul>

      {canJoin && (
        <button
          type="button"
          onClick={onJoin}
          className="w-full h-10 rounded-md text-sm font-semibold transition-colors"
          style={{
            background: `color-mix(in oklch, var(${team.color}) 8%, var(--bg-2))`,
            border: `1px dashed color-mix(in oklch, var(${team.color}) 35%, var(--line-strong))`,
            color: `var(${team.color})`,
          }}
        >
          + Занять место
        </button>
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: "var(--fg-2)" }}>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

function ConnIndicator({ status }: { status: string }) {
  const label =
    status === "connected"
      ? "ONLINE"
      : status === "connecting"
      ? "CONNECT…"
      : status === "reconnecting"
      ? "RECONNECT…"
      : status === "closed"
      ? "OFFLINE"
      : "ERROR";
  const color =
    status === "connected"
      ? "var(--accent)"
      : status === "reconnecting" || status === "connecting"
      ? "var(--warn)"
      : "var(--danger)";
  return (
    <Pill mono style={{ color, background: "var(--bg-3)" }}>
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </Pill>
  );
}

function plural(n: number): string {
  const m = n % 10;
  const t = n % 100;
  if (t >= 11 && t <= 14) return "ов";
  if (m === 1) return "";
  if (m >= 2 && m <= 4) return "а";
  return "ов";
}
function pluralZ(n: number): string {
  const m = n % 10;
  const t = n % 100;
  if (t >= 11 && t <= 14) return "ей";
  if (m === 1) return "ь";
  if (m >= 2 && m <= 4) return "я";
  return "ей";
}
