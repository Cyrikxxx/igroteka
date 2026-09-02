"use client";

// Дневные экраны Мафии: утро, обсуждение, голосование, итог, последнее слово.
// Презентационные — действия пробрасываются колбэками из play-страницы.

import { useState } from "react";
import {
  Sunrise,
  Sun,
  MessagesSquare,
  Vote,
  Scale,
  Mic,
  Check,
  UserMinus,
} from "lucide-react";
import type { MafiaView } from "@alias/shared/mafia";
import Announce from "./Announce";
import PhaseHead, { fmtClock } from "./PhaseHead";
import PlayerCard from "./PlayerCard";
import MafiaAvatar from "./MafiaAvatar";
import { RoleChip } from "./roleMeta";
import ConfirmDialog from "@/components/common/ConfirmDialog";

// ─────────── Утро ───────────
export function MorningScreen({ view }: { view: MafiaView }) {
  const fallen = view.spotlight ?? [];
  const footer = (
    <div className="mf-mono" style={{ textAlign: "center", fontSize: 13, color: "var(--mf-text-faint)", fontWeight: 700 }}>
      обсуждение через {fmtClock(view.timer?.msLeft ?? 0)}
    </div>
  );
  if (fallen.length > 0) {
    const names = fallen.map((f) => f.displayName).join(" и ");
    return (
      <Announce
        icon={Sunrise}
        iconColor="var(--mf-crimson)"
        glow="var(--sh-glow-crimson)"
        kicker="Город просыпается…"
        title={fallen.length > 1 ? `Этой ночью погибли ${names}` : `Этой ночью погиб ${names}`}
        footer={footer}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {fallen.map((f) => (
            <div
              key={f.userId}
              style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--mf-surface)", border: "1px solid var(--mf-border)", borderRadius: 16, padding: "12px 18px" }}
            >
              <MafiaAvatar name={f.displayName} idx={f.avatarIdx} size={42} dead />
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{f.displayName}</div>
                {f.role ? <RoleChip role={f.role} /> : null}
              </div>
            </div>
          ))}
        </div>
      </Announce>
    );
  }
  return (
    <Announce icon={Sun} iconColor="var(--mf-gold)" glow="var(--sh-glow-gold)" kicker="Город просыпается…" title="Этой ночью все выжили" footer={footer}>
      <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--mf-text-dim)" }}>Похоже, кому-то этой ночью повезло</div>
    </Announce>
  );
}

// ─────────── Обсуждение ───────────
export function DiscussionScreen({
  view,
  isHost,
  onEnd,
  onRemovePlayer,
}: {
  view: MafiaView;
  isHost: boolean;
  onEnd: () => void;
  /** Вывести из партии того, кто отвалился и не возвращается. */
  onRemovePlayer?: (userId: string) => void;
}) {
  // Вывод из партии необратим, поэтому спрашиваем — но своим окном, а не
  // системным confirm.
  const [removeAsk, setRemoveAsk] = useState<{ id: string; name: string } | null>(null);
  return (
    <>
      <PhaseHead icon={MessagesSquare} title={`День ${view.day} — обсуждение`} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0 8px" }}>
        <div className="mf-timer" style={{ fontSize: 64, lineHeight: 1 }}>{fmtClock(view.timer?.msLeft ?? 0)}</div>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--mf-text-faint)", marginTop: 6 }}>
          Говорите голосом — телефон подождёт
        </div>
      </div>
      <div style={{ padding: "14px 20px 0", flex: 1, display: "flex", flexDirection: "column", gap: 7, minHeight: 0, overflowY: "auto" }}>
        {view.players.map((p) => (
          <div
            key={p.userId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "var(--mf-surface)",
              border: "1px solid var(--mf-border)",
              borderRadius: 14,
              padding: "8px 12px",
              opacity: p.alive ? 1 : 0.5,
            }}
          >
            <MafiaAvatar name={p.displayName} idx={p.avatarIdx} size={34} dead={!p.alive} />
            <span style={{ fontWeight: 700, fontSize: 14.5, flex: 1, textDecoration: p.alive ? "none" : "line-through", color: p.alive ? "var(--mf-text)" : "var(--mf-text-faint)" }}>
              {p.displayName}
            </span>
            {!p.alive && p.role ? <RoleChip role={p.role} /> : null}
            {/* Обсуждение — единственная неспешная фаза, где у хоста есть
                время разобраться с теми, кто выпал и не вернулся. */}
            {isHost && p.alive && !p.online && onRemovePlayer ? (
              <button
                type="button"
                onClick={() => setRemoveAsk({ id: p.userId, name: p.displayName })}
                title="Вывести из партии"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  background: "none",
                  border: "1px solid var(--mf-border)",
                  borderRadius: 999,
                  padding: "4px 10px",
                  color: "var(--mf-text-faint)",
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <UserMinus size={13} /> не в сети
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <div style={{ padding: "12px 20px 22px" }}>
        {isHost ? (
          <button type="button" className="mf-btn mf-btn-crimson" style={{ width: "100%" }} onClick={onEnd}>
            Завершить обсуждение
          </button>
        ) : (
          <div className="mf-mono" style={{ textAlign: "center", fontSize: 13, color: "var(--mf-text-faint)", fontWeight: 700 }}>
            хост может завершить раньше
          </div>
        )}
      </div>

      <ConfirmDialog
        open={removeAsk !== null}
        variant="mafia"
        title="Вывести из партии?"
        text={
          removeAsk
            ? `${removeAsk.name} не в сети. Вернуть его в эту партию будет нельзя.`
            : undefined
        }
        confirmLabel="Вывести"
        onConfirm={() => {
          const target = removeAsk;
          setRemoveAsk(null);
          if (target) onRemovePlayer?.(target.id);
        }}
        onCancel={() => setRemoveAsk(null)}
      />
    </>
  );
}

// ─────────── Голосование ───────────
export function VoteScreen({
  view,
  onVote,
}: {
  view: MafiaView;
  onVote: (targetId: string | null) => void;
}) {
  const you = view.you;
  const vote = view.vote;
  const alive = view.players.filter((p) => p.alive);
  const round2 = vote?.round === 2;
  const candidates = vote?.leaders ?? [];
  const tally = vote?.tally;
  const max = tally ? Math.max(0, ...Object.values(tally)) : 0;

  return (
    <>
      <PhaseHead icon={Vote} title={`День ${view.day} — голосование`} timerMs={view.timer?.msLeft ?? null} />
      <div style={{ padding: "8px 20px 16px" }}>
        <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: "-0.02em" }}>
          {round2 ? "Голоса разделились" : "Кто мафия?"}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--mf-text-dim)", marginTop: 4 }}>
          {round2 ? "Выбирайте между лидерами" : "Голос можно менять, пока идёт таймер"}
        </div>
      </div>
      <div className="mf-player-grid" style={{ flex: 1, alignContent: "start" }}>
        {alive.map((p) => {
          const isMe = p.userId === you.userId;
          const blocked = isMe || (round2 && !candidates.includes(p.userId));
          const mine = you.voted === p.userId;
          const n = tally?.[p.userId] ?? 0;
          const leader = n === max && n > 0;
          return (
            <PlayerCard
              key={p.userId}
              name={p.displayName}
              avatarIdx={p.avatarIdx}
              me={isMe}
              picked={mine}
              disabled={blocked}
              onClick={() => onVote(mine ? null : p.userId)}
              badgeTopRight={
                n > 0 ? (
                  <span
                    className="mf-mono"
                    style={{
                      background: leader ? "var(--mf-crimson)" : "var(--mf-surface-2)",
                      border: leader ? "none" : "1px solid var(--mf-border)",
                      color: "#fff",
                      borderRadius: 999,
                      minWidth: 24,
                      height: 24,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      padding: "0 7px",
                    }}
                  >
                    {n}
                  </span>
                ) : undefined
              }
              subline={
                mine ? (
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--mf-crimson)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Check size={13} /> твой голос
                  </div>
                ) : undefined
              }
            />
          );
        })}
      </div>
      <div style={{ padding: "14px 20px 22px" }}>
        <button
          type="button"
          className="mf-btn mf-btn-ghost"
          style={{ width: "100%", opacity: you.voted === "abstain" ? 0.6 : 1 }}
          onClick={() => onVote(you.voted === "abstain" ? null : "abstain")}
        >
          {you.voted === "abstain" ? "Воздержался" : "Воздержаться"}
        </button>
      </div>
    </>
  );
}

// ─────────── Итог голосования ───────────
export function VoteResultScreen({ view }: { view: MafiaView }) {
  const sp = view.spotlight?.[0];
  const tie = view.vote?.tie && !view.vote?.eliminated;
  if (tie) {
    return (
      <Announce
        icon={Scale}
        iconColor="var(--mf-text-dim)"
        kicker="Голосование окончено"
        title="Голоса разделились — никто не выбывает"
        footer={
          <div className="mf-mono" style={{ textAlign: "center", fontSize: 13, color: "var(--mf-text-faint)", fontWeight: 700 }}>
            {view.vote?.round === 1 ? "переголосование…" : "ночь начнётся скоро"}
          </div>
        }
      />
    );
  }
  return (
    <Announce
      icon={Vote}
      iconColor="var(--mf-crimson)"
      glow="var(--sh-glow-crimson)"
      kicker="Голосование окончено"
      title={<span>Город изгоняет <span style={{ color: "var(--mf-crimson)" }}>{sp?.displayName ?? "игрока"}</span></span>}
      footer={
        <div className="mf-mono" style={{ textAlign: "center", fontSize: 13, color: "var(--mf-text-faint)", fontWeight: 700 }}>
          последнее слово…
        </div>
      }
    />
  );
}

// ─────────── Последнее слово ───────────
export function LastWordScreen({
  view,
  onDone,
  isHost,
}: {
  view: MafiaView;
  onDone: () => void;
  isHost: boolean;
}) {
  const sp = view.spotlight?.[0];
  const isMe = view.vote?.eliminated === view.you.userId;
  if (isMe) {
    return (
      <Announce
        icon={Mic}
        iconColor="var(--mf-gold)"
        glow="var(--sh-glow-gold)"
        kicker="Город слушает только тебя"
        title="Твоё последнее слово"
        footer={
          <button type="button" className="mf-btn mf-btn-crimson" style={{ width: "100%" }} onClick={onDone}>
            Я всё сказал
          </button>
        }
      >
        <div className="mf-timer" style={{ fontSize: 56, lineHeight: 1 }}>{fmtClock(view.timer?.msLeft ?? 0)}</div>
      </Announce>
    );
  }
  return (
    <Announce
      icon={Mic}
      iconColor="var(--mf-gold)"
      glow="var(--sh-glow-gold)"
      kicker="Город слушает"
      title={<span>Последнее слово: <span style={{ color: "var(--mf-gold)" }}>{sp?.displayName ?? "игрок"}</span></span>}
      footer={
        isHost ? (
          <button type="button" className="mf-btn mf-btn-surface" style={{ width: "100%" }} onClick={onDone}>
            Дальше
          </button>
        ) : (
          <div className="mf-mono" style={{ textAlign: "center", fontSize: 13, color: "var(--mf-text-faint)", fontWeight: 700 }}>
            после — раскрытие роли
          </div>
        )
      }
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <MafiaAvatar name={sp?.displayName ?? "?"} idx={sp?.avatarIdx ?? 0} size={64} />
        <div className="mf-timer" style={{ fontSize: 48, lineHeight: 1 }}>{fmtClock(view.timer?.msLeft ?? 0)}</div>
      </div>
    </Announce>
  );
}
