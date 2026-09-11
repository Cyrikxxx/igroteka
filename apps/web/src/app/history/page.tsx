"use client";

// Общая история партий: Алиас и Мафия в одном списке, фильтр по игре.
// Порт mafia-design/platform/screen-history.jsx.
//
// Данные живые: /api/games (Алиас), /api/mafia/history (Мафия, включая
// идущие партии), /api/stats (плитки).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  VenetianMask,
  Wifi,
  Smartphone,
  Play,
  ScrollText,
  Trash2,
  Dice5,
  RotateCcw,
  X,
} from "lucide-react";
import type { GameFromAPI } from "@/types";
import { historyLines } from "@/lib/history-rows";
import type { MafiaSettings, MafiaCreateRoomResponse } from "@alias/shared/mafia";
import { prepareLocalRematch, createRoomLike } from "@/lib/rematch";
import { loadDisplayName, saveRoomCreds } from "@/lib/room-session";
import PageShell, { PageHead, PageFooter } from "@/components/platform/PageShell";
import { ROLE_META } from "@/components/mafia/roleMeta";
import { formatDayRu } from "@/lib/utils";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import type { MafiaHistoryGame } from "@/app/api/mafia/history/route";

interface Stats {
  games: number;
  guessedWords: number;
  successRate: number;
  mafiaGames: number;
  mafiaWins: number;
}

type Filter = "all" | "alias" | "mafia";

const THEME = {
  alias: { accent: "var(--alias-green)", label: "Алиас", Icon: Sparkles, dark: true },
  mafia: { accent: "var(--mf-crimson)", label: "Мафия", Icon: VenetianMask, dark: false },
} as const;

/** Обе игры приводим к одной форме, чтобы список был единым. */
interface Row {
  key: string;
  game: "alias" | "mafia";
  online: boolean;
  live: boolean;
  /** Куда ведёт основная кнопка. */
  href: string;
  /** Когда партия была — по ней обе игры выстраиваются в один список. */
  time: number;
  meta: string;
  body: React.ReactNode;
  /** Удалять можно только локальные партии Алиаса — они наши. */
  onDelete?: () => void;
  /** Собрать такую же новую партию. У идущих не показываем — они ещё идут. */
  onAgain?: () => void;
}

/**
 * Строка карточки: игрок слева, его команда и счёт справа. Названия команд
 * сами по себе ни о чём не говорят — через неделю не вспомнить, кто в «Лисах»
 * играл. Втроём команда и есть игрок, и вторая колонка тогда пустая.
 */
/**
 * Строка участника в карточке истории. Одна на обе игры: в Алиасе справа
 * команда и счёт, в Мафии — роль, счёта там нет.
 */
function PlayerRow({
  name,
  team,
  score,
  color,
}: {
  name: string;
  /** Правая подпись: команда в Алиасе, роль в Мафии. */
  team: string | null;
  /** Только у Алиаса: в Мафии очков не бывает. */
  score?: number;
  /** Имя переменной («--team-1») или готовый цвет («var(--role-mafia)»). */
  color: string;
}) {
  return (
    <div className="hist-line">
      <span className="hist-line-name">
        <span
          className="hist-dot"
          style={{ background: color.startsWith("--") ? `var(${color})` : color }}
        />
        <span className="hist-line-nm">{name}</span>
      </span>
      <span className="hist-line-right">
        {team ? <span className="hist-line-team">{team}</span> : null}
        {score === undefined ? null : (
          <span className="mf-mono hist-line-value">{score}</span>
        )}
      </span>
    </div>
  );
}

export default function HistoryPage() {
  const [games, setGames] = useState<GameFromAPI[] | null>(null);
  const [mafia, setMafia] = useState<MafiaHistoryGame[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const router = useRouter();
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  // Ошибки показываем плашкой на странице, а не системным alert.
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/games")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: GameFromAPI[]) => setGames(d))
      .catch(() => setGames([]));
    fetch("/api/mafia/history")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: MafiaHistoryGame[]) => setMafia(d))
      .catch(() => setMafia([]));
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Stats | null) => setStats(d))
      .catch(() => setStats(null));
  }, []);

  // Локальную партию удаляем по-настоящему — она и правда только твоя.
  // Онлайн-партию видят все участники, поэтому «убрать» прячет карточку
  // только у тебя, и об этом честно спрашиваем.
  interface Pending {
    key: string;
    id: string;
    game: "alias" | "mafia";
  }
  const [deleteAsk, setDeleteAsk] = useState<Pending | null>(null);
  const askDelete = (p: Pending, confirm: boolean) => {
    if (confirm) setDeleteAsk(p);
    else void remove(p);
  };
  const remove = async (p: Pending) => {
    setDeletingKey(p.key);
    try {
      const url = p.game === "mafia" ? `/api/mafia/games/${p.id}` : `/api/games/${p.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        setActionError("Не удалось убрать партию из истории");
        return;
      }
      if (p.game === "mafia") setMafia((m) => m.filter((x) => x.id !== p.id));
      else setGames((g) => (g ?? []).filter((x) => x.id !== p.id));
    } finally {
      setDeletingKey(null);
    }
  };

  // Собрать такую же новую партию: локальную — с теми же командами,
  // онлайн — новой комнатой с теми же правилами (людей зовём по ссылке).
  const [againBusy, setAgainBusy] = useState(false);
  const againAlias = async (g: GameFromAPI) => {
    if (againBusy) return;
    setAgainBusy(true);
    try {
      if (g.mode === "LOCAL") {
        prepareLocalRematch(g);
        router.push("/alias/local/new");
      } else {
        const code = await createRoomLike(g);
        router.push(`/alias/room/${code}`);
      }
    } catch (e) {
      setActionError((e as Error).message);
      setAgainBusy(false);
    }
  };
  const againMafia = async (settings: MafiaSettings) => {
    if (againBusy) return;
    setAgainBusy(true);
    try {
      const res = await fetch("/api/mafia/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName: loadDisplayName().trim() || "Хост", settings }),
      });
      if (!res.ok) throw new Error("Не удалось создать комнату");
      const data: MafiaCreateRoomResponse = await res.json();
      saveRoomCreds({
        code: data.room.code,
        wsUrl: data.wsUrl,
        wsToken: data.wsToken,
        userId: data.user.id,
        displayName: data.user.displayName,
        game: "mafia",
      });
      router.push(`/mafia/room/${data.room.code}`);
    } catch (e) {
      setActionError((e as Error).message);
      setAgainBusy(false);
    }
  };

  const aliasRows: Row[] = (games ?? []).map((g) => {
    const live = g.status === "IN_PROGRESS";
    const online = g.mode === "ONLINE";
    const href = live
      ? online && g.room?.code
        ? `/alias/room/${g.room.code}`
        : `/alias/local/${g.id}/turn`
      : `/alias/results/${g.id}`;
    return {
      key: `alias-${g.id}`,
      game: "alias",
      online,
      live,
      href,
      time: new Date(g.finishedAt ?? g.updatedAt ?? g.createdAt).getTime(),
      meta: `${g.currentRoundNumber} ${g.currentRoundNumber === 1 ? "раунд" : "раунда"}`,
      body: (
        <div className="hist-lines hist-lines-scroll">
          {historyLines(g).map((l) => (
            <PlayerRow
              key={l.key}
              name={l.name}
              team={l.team}
              score={l.score}
              color={l.color}
            />
          ))}
        </div>
      ),
      // Убрать можно всё, кроме идущей онлайн-партии: её состояние живёт ещё
      // и в Redis, и в открытых сокетах, а из идущей партии выходят, а не
      // прячут её. У онлайновой кнопка есть у всех участников: она убирает
      // карточку только из своей истории.
      onDelete:
        online && live
          ? undefined
          : () => askDelete({ key: `alias-${g.id}`, id: g.id, game: "alias" }, online),
      onAgain: live ? undefined : () => againAlias(g),
    };
  });

  const mafiaRows: Row[] = mafia.map((m) => {
    const live = m.status === "live";
    const winnerLabel =
      m.winner === "MAFIA" ? "Победа мафии" : m.winner === "MANIAC" ? "Победа маньяка" : "Победа мирных";
    const winnerColor =
      m.winner === "MAFIA"
        ? "var(--mf-crimson)"
        : m.winner === "MANIAC"
          ? "var(--role-maniac)"
          : "var(--role-civilian)";
    return {
      key: `mafia-${m.id}`,
      game: "mafia",
      online: true,
      live,
      time: new Date(m.endedAt ?? m.createdAt).getTime(),
      href: live && m.code ? `/mafia/room/${m.code}` : `/mafia/results/${m.id}`,
      onAgain: !live && m.settings ? () => againMafia(m.settings!) : undefined,
      // Идущую партию не прячем — из неё выходят. Завершённую убирает у себя
      // любой, кто в ней играл.
      onDelete: live
        ? undefined
        : () => askDelete({ key: `mafia-${m.id}`, id: m.id, game: "mafia" }, true),
      meta: `${m.dayCount} ${m.dayCount === 1 ? "ночь" : "ночи"}`,
      body: (
        <div className="hist-lines hist-lines-scroll">
          <div className="hist-line">
            <span className="hist-line-name">
              <span
                className="hist-dot"
                style={{ background: live ? "var(--mf-gold)" : winnerColor }}
              />
              {live ? m.phase : winnerLabel}
            </span>
            <span className="mf-mono hist-line-value hist-line-faint">
              {live ? `${m.alive}/${m.players} в игре` : `${m.players} игроков`}
            </span>
          </div>
          {/* Состав, как в карточке Алиаса: названия стадии мало, через
              неделю по нему не вспомнить, что это была за партия. У идущей
              ролей нет — их не отдаёт и сервер. */}
          {(m.roster ?? []).map((p, i) => (
            <PlayerRow
              key={`${m.id}-${i}`}
              name={p.name}
              team={p.role ? ROLE_META[p.role].label : p.alive ? "в игре" : "выбыл"}
              color={p.role ? ROLE_META[p.role].color : "var(--fg-3)"}
            />
          ))}
        </div>
      ),
    };
  });

  // Один список по времени, а не «сначала весь Алиас, потом вся Мафия»:
  // иначе вчерашняя партия Алиаса стоит выше сегодняшней Мафии.
  const all = [...aliasRows, ...mafiaRows].sort((a, b) => b.time - a.time);
  const rows = all.filter((r) => filter === "all" || r.game === filter);
  const loading = games === null;

  return (
    <PageShell active="История">
      <PageHead
        title="История игр"
        lead="Партии Алиаса и Мафии в одном списке — незавершённую игру можно открыть и доиграть."
      />

      {actionError && (
        <div className="notice notice-danger room-notice" style={{ marginBottom: 18 }}>
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

      <div className="hist-stats">
        <div className="pl-card hist-stat">
          <div className="mf-mono hist-stat-value">{stats ? stats.games + stats.mafiaGames : "—"}</div>
          <div className="hist-stat-label">Сыграно партий</div>
        </div>
        <div className="pl-card hist-stat">
          <div className="mf-mono hist-stat-value" style={{ color: "var(--alias-green)" }}>
            {stats ? stats.guessedWords.toLocaleString("ru") : "—"}
          </div>
          <div className="hist-stat-label">Угадано слов в партиях</div>
        </div>
        <div className="pl-card hist-stat">
          <div className="mf-mono hist-stat-value" style={{ color: "var(--mf-crimson)" }}>
            {stats ? stats.mafiaWins : "—"}
          </div>
          <div className="hist-stat-label">Побед за мафию</div>
        </div>
      </div>

      <div className="hist-toolbar">
        <div className="pl-tabs">
          {([
            ["all", "Все", "var(--mf-text)"],
            ["alias", "Алиас", "var(--alias-green)"],
            ["mafia", "Мафия", "var(--mf-crimson)"],
          ] as [Filter, string, string][]).map(([key, label, color]) => {
            const on = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={"pl-tab pl-tab-sm" + (on ? " pl-tab-on" : "")}
                style={
                  on
                    ? {
                        background: `color-mix(in srgb, ${color} 14%, transparent)`,
                        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
                        color,
                      }
                    : undefined
                }
              >
                {label}
              </button>
            );
          })}
        </div>
        <span className="mf-mono hist-count">
          {rows.length} из {all.length}
        </span>
      </div>

      {loading ? (
        <p className="pl-text">Загрузка…</p>
      ) : rows.length === 0 ? (
        <div className="pl-card hist-empty">
          <span className="hist-empty-ic">
            <Dice5 size={30} />
          </span>
          <div className="pl-card-title">
            {all.length === 0 ? "Пока ни одной партии" : "В этом фильтре пусто"}
          </div>
          <p className="pl-text">
            {all.length === 0
              ? "Сыграйте первую — она появится здесь вместе со счётом."
              : "Попробуйте выбрать другую игру."}
          </p>
          {all.length === 0 ? (
            <Link href="/" className="mf-btn mf-btn-surface hist-empty-cta">
              Выбрать игру
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="hist-grid">
          {rows.map((r) => {
            const t = THEME[r.game];
            const Icon = t.Icon;
            return (
              <div
                key={r.key}
                className="pl-card hist-card"
                style={{
                  borderTop: `3px solid ${
                    r.live ? t.accent : `color-mix(in srgb, ${t.accent} 45%, var(--ink-surface))`
                  }`,
                }}
              >
                <div className="hist-card-head">
                  <span className="hist-card-game" style={{ color: t.accent }}>
                    <Icon size={16} /> {t.label}
                  </span>
                  <span className="mf-mono hist-card-mode">
                    {r.online ? <Wifi size={12} /> : <Smartphone size={12} />}
                    {r.online ? "Онлайн" : "Локально"}
                  </span>
                </div>

                {r.body}

                <div className="hist-card-foot">
                  <span className="mf-mono hist-card-meta">
                    {r.meta} · {formatDayRu(r.time)}
                  </span>
                  <div className="hist-card-actions">
                    <Link
                      href={r.href}
                      className="mf-btn hist-card-btn"
                      style={
                        r.live
                          ? { background: t.accent, color: t.dark ? "#06130a" : "#fff" }
                          : { background: "transparent", color: "var(--mf-text-dim)", border: "1px solid var(--ink-border)" }
                      }
                    >
                      {r.live ? <Play size={16} /> : <ScrollText size={16} />}
                      {r.live ? "Продолжить" : "Итоги"}
                    </Link>
                    {r.onAgain ? (
                      <button
                        type="button"
                        onClick={r.onAgain}
                        disabled={againBusy}
                        className="mf-btn hist-card-btn"
                        style={{ background: t.accent, color: t.dark ? "#06130a" : "#fff" }}
                      >
                        <RotateCcw size={16} /> Сыграть так же
                      </button>
                    ) : null}
                    {r.onDelete ? (
                      <button
                        type="button"
                        onClick={r.onDelete}
                        disabled={deletingKey === r.key}
                        className="hist-card-del"
                        aria-label="Убрать из истории"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleteAsk !== null}
        title="Убрать из своей истории?"
        text="У остальных участников партия останется — чужую историю это не трогает."
        confirmLabel="Убрать"
        onConfirm={() => {
          const p = deleteAsk;
          setDeleteAsk(null);
          if (p) void remove(p);
        }}
        onCancel={() => setDeleteAsk(null)}
      />

      <PageFooter />
    </PageShell>
  );
}
