"use client";

// Лобби онлайн-комнаты. Дизайн — LobbyScreen из редизайна.
// Вся realtime-логика сохранена: useRoom, команды, старт игры, реконнект.

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RoomSnapshotTeam } from "@alias/shared/domain";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Play,
  Plus,
  Settings,
  Link2,
  Trash2,
  Crown,
  UserX,
  Unlock,
  X,
  Pencil,
} from "lucide-react";
import {
  MAX_TEAMS,
  MAX_PLAYERS_PER_TEAM,
  MIN_TEAMS,
  MIN_PLAYERS_PER_TEAM,
  TRIO_TEAMS,
} from "@/constants/game";
import { TRIO_TURNS } from "@alias/shared/trio";
import type { GameFormat } from "@/types";
import Chip from "@/components/common/Chip";
import { loadRoomCreds, clearRoomCreds, saveDisplayName } from "@/lib/room-session";
import { resumeRoom } from "@/lib/room-resume";
import { setRoomNotice } from "@/lib/room-notice";
import { useRoom } from "@/hooks/useRoom";
import { useHostClaim } from "@/hooks/useHostClaim";
import { useHydrated } from "@/hooks/useHydrated";
import { pluralize, PLAYERS, SPECTATORS } from "@/lib/plural";
import AppShell from "@/components/common/AppShell";
import Avatar from "@/components/common/Avatar";
import RoomCode from "@/components/common/RoomCode";
import QrCode from "@/components/common/QrCode";
import Modal from "@/components/common/Modal";
import RoomSettingsModal from "@/components/alias/room/RoomSettingsModal";

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
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  // Ошибки действий показываем строкой в лобби, а не системным alert.
  const [actionError, setActionError] = useState<string | null>(null);

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

  const roomOpts = useMemo(
    () => (creds ? { wsUrl: creds.wsUrl, token: creds.wsToken, code: creds.code } : null),
    [creds],
  );
  const { emit, snapshot, status, error, closedReason } = useRoom(roomOpts);
  // Вызываем до ранних return'ов: порядок хуков не должен зависеть от того,
  // загрузились ли уже креды и снапшот.
  const claim = useHostClaim(
    snapshot?.hostOfflineSince,
    !!creds && snapshot?.hostId === creds.userId,
  );

  // Выгнали или комнату закрыли — уводим на главный экран Алиаса и объясняем
  // там, что случилось. Раньше поверх лобби висело окно, а сама комната
  // оставалась под ним: любое переподключение возвращало человека обратно.
  useEffect(() => {
    if (!closedReason) return;
    clearRoomCreds(rawCode);
    setRoomNotice({ text: closedReason, tone: "danger" });
    router.replace("/alias");
  }, [closedReason, rawCode, router]);

  // Авто-редирект на игровой экран при старте игры. Эффекту нужна только
  // фаза — берём её отдельно, чтобы не срабатывать на каждое обновление
  // комнаты.
  const phase = snapshot?.phase;
  const myCode = creds?.code;
  useEffect(() => {
    if (!phase || !myCode) return;
    if (
      phase === "PRE_ROUND" ||
      phase === "ROUND_ACTIVE" ||
      phase === "ROUND_REVIEW" ||
      phase === "BETWEEN_ROUNDS" ||
      // Финал живёт внутри комнаты: оттуда хост может собрать всех заново.
      phase === "FINISHED"
    ) {
      router.replace(`/alias/room/${myCode}/play`);
    }
  }, [phase, myCode, router]);

  if (!creds) {
    return (
      <AppShell centered>
        <p className="muted" style={{ textAlign: "center" }}>
          Загрузка…
        </p>
      </AppShell>
    );
  }

  const isHost = snapshot?.hostId === creds.userId;
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/alias/join?code=${creds.code}`
      : `/alias/join?code=${creds.code}`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(creds.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  // Просто кладём ссылку в буфер. Системная шторка «Поделиться» здесь только
  // мешала: она перекрывает лобби, а на десктопе всё равно сводится к буферу.
  const handleShareLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1600);
    } catch {}
  };
  const handleLeave = () => {
    emit("room:leave", {}, () => {});
    clearRoomCreds(creds.code);
    router.push("/alias");
  };
  const setFormat = (format: GameFormat) =>
    emit("room:format", { format }, (resp: unknown) => {
      if (resp && typeof resp === "object" && "error" in (resp as Record<string, unknown>)) {
        setActionError(`Не удалось сменить формат: ${(resp as { error: string }).error}`);
      }
    });
  const createTeam = () => emit("team:create", {}, () => {});
  const renameTeam = (teamId: number, name: string) =>
    emit("team:rename", { teamId, name }, () => {});
  const removeTeam = (teamId: number) => emit("team:remove", { teamId }, () => {});
  const joinTeam = (teamId: number | null) => emit("team:join", { teamId }, () => {});
  // Кик и передача хоста обратимы, поэтому делаются сразу: лишний вопрос на
  // каждое нажатие только мешал.
  const kickPlayer = (userId: string) => emit("room:kick", { userId }, () => {});
  const unban = (userId: string) => emit("room:unban", { userId }, () => {});
  const makeHost = (userId: string) =>
    emit("room:transfer_host", { userId }, () => {});

  // Своя запись в снапшоте — она же источник актуального ника: его мог
  // поменять и сам игрок, и другая вкладка.
  const me =
    snapshot?.teams
      .flatMap((t) => t.players)
      .find((p) => p.userId === creds.userId) ??
    snapshot?.spectators.find((p) => p.userId === creds.userId) ??
    null;
  const myName = me?.displayName ?? creds.displayName;
  const inLobby = snapshot?.phase === "LOBBY";

  const claimHost = () =>
    emit("room:claim_host", {}, (resp: unknown) => {
      if (resp && typeof resp === "object" && "error" in (resp as Record<string, unknown>)) {
        // Обычно это значит, что хост успел вернуться между показом кнопки и
        // нажатием — снапшот сам себя поправит следующим broadcast'ом.
        console.warn("claim_host:", (resp as { error: string }).error);
      }
    });

  const commitMyName = (input: HTMLInputElement) => {
    const next = input.value.trim().slice(0, 50);
    setEditingName(false);
    if (!next || next === myName) return;
    emit("room:set_name", { displayName: next }, () => {});
    // Запоминаем и глобально: следующий вход подставит новое имя сам.
    saveDisplayName(next);
  };

  // Всё, что нужно строке со своим именем: правится она прямо в списке.
  const nameEditor: NameEditor = {
    myName,
    editing: editingName,
    enabled: inLobby,
    start: () => setEditingName(true),
    commit: commitMyName,
  };

  const myTeam = snapshot?.teams.find((t) => t.players.some((p) => p.userId === creds.userId));
  const playersTotal = snapshot?.teams.reduce((s, t) => s + t.players.length, 0) ?? 0;
  const spectatorsTotal = snapshot?.spectators.length ?? 0;
  const teamsCount = snapshot?.teams.length ?? 0;
  const allTeamsHaveEnoughOnline =
    teamsCount >= MIN_TEAMS &&
    (snapshot?.teams ?? []).every(
      (t) => t.players.filter((p) => p.online).length >= MIN_PLAYERS_PER_TEAM,
    );

  // Втроём мест ровно три, и стартовать можно, только когда все заняты: пара
  // на каждый ход задана правилами круга, подставить вместо пустого некого.
  const trio = (snapshot?.format ?? "TEAMS") === "TRIO";
  const seatsTaken = (snapshot?.teams ?? []).filter((t) =>
    t.players.some((p) => p.online),
  ).length;
  const canStart = trio
    ? teamsCount === TRIO_TEAMS && seatsTaken === TRIO_TEAMS
    : allTeamsHaveEnoughOnline;

  const s = snapshot?.settings;

  return (
    <AppShell className="screen-anim">
      <button type="button" className="back-link" onClick={handleLeave}>
        <ArrowLeft /> Выйти из комнаты
      </button>

      <div className="lobby-head">
        <div>
          <span className="eyebrow">{isHost ? "лобби · хост" : "лобби · участник"}</span>
          <h1 className="h-display" style={{ marginTop: 8 }}>
            {snapshot?.title || (isHost ? "Ждём игроков" : "Ты в комнате")}
          </h1>
          <p className="h-sub" style={{ marginTop: 8 }}>
            {snapshot
              ? `${pluralize(playersTotal, PLAYERS)} · ${pluralize(spectatorsTotal, SPECTATORS)}`
              : "Подключаемся…"}
          </p>
        </div>
      </div>

      {error && (
        <div className="notice notice-danger" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Хост пропал. Комнату у него не отбирали — но и висеть без хозяина
          она не должна: через минуту любой может забрать её кнопкой. */}
      {claim.hostGone && (
        <div className="notice notice-warn room-claim">
          <span style={{ flex: 1 }}>
            {claim.canClaim
              ? "Хост не в сети. Можно взять комнату на себя — тогда настройки и старт будут у тебя."
              : `Хост не в сети. Взять комнату на себя можно через ${claim.secondsLeft} с.`}
          </span>
          {claim.canClaim && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={claimHost}>
              <Crown size={15} /> Взять комнату на себя
            </button>
          )}
        </div>
      )}
      {actionError && (
        <div className="notice notice-danger room-notice" style={{ marginBottom: 16 }}>
          <span style={{ flex: 1 }}>{actionError}</span>
          <button
            type="button"
            className="room-notice-x"
            onClick={() => setActionError(null)}
            aria-label="Закрыть"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="lobby-grid">
        {/* Панель приглашения */}
        <aside className="lobby-invite">
          <div className="card invite-card">
            <span className="eyebrow">код комнаты</span>
            <div className="invite-code">
              <RoomCode code={creds.code} />
            </div>
            <div className="invite-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyCode}>
                {copied ? <Check /> : <Copy />} {copied ? "Скопировано" : "Код"}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleShareLink}>
                {linkCopied ? <Check /> : <Link2 />} {linkCopied ? "Скопировано" : "Ссылка"}
              </button>
            </div>
            <div className="dotted" style={{ margin: "22px 0" }} />
            <div className="invite-qr">
              <QrCode value={inviteUrl} />
              <div>
                <p className="invite-qr-t">Сканируй, чтобы войти</p>
                <p className="invite-qr-s mono">{inviteUrl}</p>
              </div>
            </div>
          </div>

          <div className="card lobby-rules">
            <div className="row-between">
              <span className="lr-l">Раунд</span>
              <span className="lr-v mono">{s?.roundTime ?? "—"} сек</span>
            </div>
            <div className="row-between">
              <span className="lr-l">Цель</span>
              <span className="lr-v mono">{s?.winScore ?? "—"} очков</span>
            </div>
            <div className="row-between">
              <span className="lr-l">Штраф за пропуск</span>
              <span className="lr-v mono">{s?.penaltySkip ? "−1" : "нет"}</span>
            </div>
            <div className="row-between">
              <span className="lr-l">Категорий</span>
              <span className="lr-v mono">{s?.categoryIds.length ?? 0}</span>
            </div>
          </div>
        </aside>

        {/* Команды */}
        <div className="lobby-teams-wrap">
          <div className="row-between lobby-teams-head">
            <h2 className="h-title">
              {trio ? `Места ${seatsTaken}/${TRIO_TEAMS}` : `Команды ${teamsCount}/${MAX_TEAMS}`}
            </h2>
            {isHost && !trio && teamsCount < MAX_TEAMS && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={createTeam}>
                <Plus /> Команда
              </button>
            )}
          </div>

          {isHost && (
            <div className="chip-row" style={{ marginBottom: "var(--gap)" }}>
              <Chip active={!trio} onClick={() => setFormat("TEAMS")}>
                Командами
              </Chip>
              <Chip active={trio} onClick={() => setFormat("TRIO")}>
                Втроём
              </Chip>
            </div>
          )}

          {trio ? (
            <div className="lobby-seats">
              {snapshot?.teams.map((team, idx) => (
                <SeatCard
                  key={team.id}
                  seat={idx + 1}
                  team={team}
                  currentUserId={creds.userId}
                  hostId={snapshot.hostId}
                  isHost={isHost}
                  onTake={() => joinTeam(team.id)}
                  onKick={kickPlayer}
                  onMakeHost={makeHost}
                  nameEditor={nameEditor}
                />
              ))}
              <p className="muted seat-note">
                Играют парами: один объясняет, второй угадывает, третий пропускает
                ход — очки получают оба. За круг из {TRIO_TURNS} ходов каждый
                расскажет обоим и поугадывает у обоих.
              </p>
            </div>
          ) : teamsCount === 0 ? (
            <div className="card" style={{ border: "1px dashed var(--line-strong)", boxShadow: "none", textAlign: "center" }}>
              <p className="muted">
                Команд пока нет. {isHost ? "Создайте первую." : "Подождите хоста."}
              </p>
            </div>
          ) : (
            <div className="lobby-teams">
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
                  onKick={kickPlayer}
                  onMakeHost={makeHost}
                  nameEditor={nameEditor}
                />
              ))}
            </div>
          )}

          {isHost && (snapshot?.banned?.length ?? 0) > 0 && (
            <div className="card" style={{ marginTop: "var(--gap)" }}>
              <div className="row-between" style={{ marginBottom: 12 }}>
                <h3 className="h-title" style={{ fontSize: 16 }}>
                  Заблокированные ({snapshot?.banned?.length})
                </h3>
                <span className="muted" style={{ fontSize: 12 }}>видно только тебе</span>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                {snapshot?.banned?.map((b) => (
                  <div key={b.userId} className="lobby-player">
                    <Avatar name={b.displayName} size={30} />
                    <span className="lp-name">{b.displayName}</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ marginLeft: "auto", flex: "none" }}
                      onClick={() => unban(b.userId)}
                    >
                      <Unlock size={15} /> Разблокировать
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Зрители */}
          <div className="card" style={{ marginTop: "var(--gap)" }}>
            <div className="row-between" style={{ marginBottom: 12 }}>
              <h3 className="h-title" style={{ fontSize: 16 }}>
                Зрители ({spectatorsTotal})
              </h3>
              {myTeam && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => joinTeam(null)}>
                  В зрители
                </button>
              )}
            </div>
            {spectatorsTotal === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>
                никого
              </p>
            ) : (
              <div className="chip-row">
                {snapshot?.spectators.map((sp) => (
                  <span key={sp.userId} className="pill" style={{ opacity: sp.online ? 1 : 0.55 }}>
                    {sp.online && <span className="dot" style={{ color: "var(--accent)" }} />}
                    {sp.displayName}
                    {sp.userId === snapshot.hostId && " 👑"}
                    {/* Своё имя правится и отсюда: в команду человек мог ещё
                        не сесть, а ник поправить уже хочется. */}
                    {sp.userId === creds.userId && inLobby && !editingName && (
                      <button
                        type="button"
                        className="lp-edit"
                        onClick={() => setEditingName(true)}
                        aria-label="Изменить своё имя"
                        title="Изменить имя"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
            {/* Правка ника зрителя: в «пилюлю» поле не влезает, поэтому оно
                разворачивается под списком. */}
            {editingName && !myTeam && (
              <div className="row" style={{ gap: 10, marginTop: 12 }}>
                <Avatar name={myName} size={30} />
                <MyNameCell editor={nameEditor} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky action */}
      <div className="lobby-foot">
        {isHost ? (
          <>
            <span className="muted">
              {canStart
                ? `${pluralize(playersTotal, PLAYERS)} · готово к старту`
                : trio
                  ? `Нужны все ${TRIO_TEAMS} места — занято ${seatsTaken}`
                  : `Нужно ≥${MIN_TEAMS} команды, в каждой ≥${MIN_PLAYERS_PER_TEAM} игрока онлайн`}
            </span>
            <div className="row" style={{ gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setSettingsOpen(true)}>
                <Settings /> Настройки
              </button>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={!canStart}
                onClick={() => {
                  emit("round:start_game", {}, (resp: unknown) => {
                    if (resp && typeof resp === "object" && "error" in (resp as Record<string, unknown>)) {
                      setActionError(`Не удалось стартовать: ${(resp as { error: string }).error}`);
                    }
                  });
                }}
              >
                <Play /> Начать игру
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="muted">
              {myTeam ? `Ты в команде «${myTeam.name}»` : "Ты в зрителях"}
            </span>
            {/* Кнопки «Сменить команду» тут больше нет: она звала команду
                поменять, а на деле уводила в зрители. Перейти в другую
                команду можно нажатием на саму команду, выйти из своей —
                кнопкой «В зрители» над списком. */}
            <div className="row" style={{ gap: 10 }}>
              <span className="pill">
                <Clock /> Ждём старта…
              </span>
            </div>
          </>
        )}
      </div>

      {/* Настройки комнаты (host) */}
      {snapshot && (
        <RoomSettingsModal
          open={settingsOpen}
          settings={snapshot.settings}
          onClose={() => setSettingsOpen(false)}
          onSave={(next) => {
            emit("room:settings", next, () => {});
            setSettingsOpen(false);
          }}
        />
      )}

      {/* Reconnect overlay */}
      <Modal isOpen={status === "reconnecting" || (status === "error" && !!error)} fullscreen>
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
    </AppShell>
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
  onKick,
  onMakeHost,
  nameEditor,
}: {
  team: RoomSnapshotTeam;
  currentUserId: string;
  hostId: string;
  isHost: boolean;
  onRename: (name: string) => void;
  onRemove: () => void;
  onJoin: () => void;
  onKick: (userId: string) => void;
  onMakeHost: (userId: string) => void;
  nameEditor: NameEditor;
}) {
  const meIsHere = team.players.some((p) => p.userId === currentUserId);
  const canJoin = !meIsHere && team.players.length < MAX_PLAYERS_PER_TEAM;

  return (
    <div className="team-card lobby-team" style={{ "--tc": `var(${team.color})` } as React.CSSProperties}>
      <div style={{ marginBottom: 14 }}>
        {/* Имя и корзина — на одной строке; счётчик игроков под ними. */}
        <div className="row" style={{ gap: 10 }}>
          {isHost ? (
            // Имя редактируется по тапу (как в офлайне); коммит на blur/Enter → socket rename.
            // key={team.name} ресинкает поле, когда имя меняется на сервере.
            <input
              key={team.name}
              className="st-name-input"
              style={{ flex: 1, minWidth: 0 }}
              defaultValue={team.name}
              maxLength={30}
              placeholder="Название"
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== team.name) onRename(next);
                else e.target.value = team.name;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  e.currentTarget.value = team.name;
                  e.currentTarget.blur();
                }
              }}
            />
          ) : (
            <span className="lt-name" style={{ flex: 1, minWidth: 0 }}>
              {team.name}
            </span>
          )}
          {isHost && (
            <button
              type="button"
              className="icon-btn"
              style={{ width: 36, flex: "none" }}
              onClick={onRemove}
              aria-label="Удалить команду"
              title="Удалить команду"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
        <span className="lt-count mono" style={{ display: "block", marginTop: 6 }}>
          {team.players.length}/{MAX_PLAYERS_PER_TEAM} игроков
        </span>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {team.players.length === 0 ? (
          <p className="st-empty">пока пусто</p>
        ) : (
          team.players.map((p) => {
            const isMe = p.userId === currentUserId;
            const isCrown = p.userId === hostId;
            return (
              <div key={p.userId} className="lobby-player" style={{ opacity: p.online ? 1 : 0.55 }}>
                <Avatar name={p.displayName} color={team.color} size={30} online={p.online} />
                {isMe ? (
                  <MyNameCell editor={nameEditor} />
                ) : (
                  <span className="lp-name">{p.displayName}</span>
                )}
                {isCrown && <span className="pill pill-mono pill-accent">хост</span>}
                {isHost && !isMe && (
                  <div className="lobby-player-actions">
                    <button
                      type="button"
                      className="slot-x"
                      onClick={() => onMakeHost(p.userId)}
                      aria-label={`Передать комнату — ${p.displayName}`}
                      title="Сделать хостом"
                    >
                      <Crown size={15} />
                    </button>
                    <button
                      type="button"
                      className="slot-x"
                      onClick={() => onKick(p.userId)}
                      aria-label={`Выгнать ${p.displayName}`}
                      title="Выгнать"
                    >
                      <UserX size={15} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
        {canJoin && (
          <button type="button" className="lobby-add" onClick={onJoin}>
            <Plus size={16} /> Занять место
          </button>
        )}
      </div>
    </div>
  );
}


/**
 * Одно место в режиме «втроём». Команд тут нет: место рассчитано на одного,
 * названия не редактируются и удалить его нельзя — мест всегда три.
 */
function SeatCard({
  seat,
  team,
  currentUserId,
  hostId,
  isHost,
  onTake,
  onKick,
  onMakeHost,
  nameEditor,
}: {
  seat: number;
  team: RoomSnapshotTeam;
  currentUserId: string;
  hostId: string;
  isHost: boolean;
  onTake: () => void;
  onKick: (userId: string) => void;
  onMakeHost: (userId: string) => void;
  nameEditor: NameEditor;
}) {
  const player = team.players[0] ?? null;
  const isMe = player?.userId === currentUserId;

  return (
    <div
      className={"seat-card" + (player ? " taken" : "")}
      style={{ "--tc": `var(${team.color})` } as React.CSSProperties}
    >
      <span className="seat-num mono">{seat}</span>
      {player ? (
        <>
          <Avatar name={player.displayName} color={team.color} size={34} online={player.online} />
          {isMe ? (
            <MyNameCell editor={nameEditor} />
          ) : (
            <span className="lp-name">{player.displayName}</span>
          )}
          {player.userId === hostId && <span className="pill pill-mono pill-accent">хост</span>}
          {isHost && !isMe && (
            <div className="lobby-player-actions">
              <button
                type="button"
                className="icon-btn"
                onClick={() => onMakeHost(player.userId)}
                aria-label="Передать комнату"
                title="Передать комнату"
              >
                <Crown size={15} />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onKick(player.userId)}
                aria-label="Выгнать"
                title="Выгнать"
              >
                <UserX size={15} />
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <span className="seat-free">Свободно</span>
          <button type="button" className="btn btn-secondary btn-sm seat-take" onClick={onTake}>
            Занять
          </button>
        </>
      )}
    </div>
  );
}

/** Всё, что нужно строке со своим именем в списке игроков. */
interface NameEditor {
  myName: string;
  editing: boolean;
  /** Пока идёт партия имя менять нельзя: оно уже уехало в состав команд. */
  enabled: boolean;
  start: () => void;
  commit: (input: HTMLInputElement) => void;
}

/**
 * Своя строка в списке: имя правится тут же, по карандашу рядом с ним.
 * Отдельного поля где-то в стороне для этого не нужно.
 */
function MyNameCell({ editor }: { editor: NameEditor }) {
  if (editor.editing) {
    return (
      <input
        autoFocus
        className="input lp-name-input"
        defaultValue={editor.myName}
        maxLength={50}
        onBlur={(e) => editor.commit(e.target)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = editor.myName;
            e.currentTarget.blur();
          }
        }}
      />
    );
  }
  return (
    <span className="lp-name">
      {editor.myName}
      <em> · ты</em>
      {editor.enabled && (
        <button
          type="button"
          className="lp-edit"
          onClick={editor.start}
          aria-label="Изменить своё имя"
          title="Изменить имя"
        >
          <Pencil size={14} />
        </button>
      )}
    </span>
  );
}
