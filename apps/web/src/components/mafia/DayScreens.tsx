"use client";

// Дневные экраны Мафии: утро, обсуждение, голосование, итог, последнее слово.
// Презентационные — действия пробрасываются колбэками из play-страницы.

import {
  Sunrise,
  Sun,
  MessagesSquare,
  Vote,
  Scale,
  Mic,
  Check,
} from "lucide-react";
import type { MafiaView } from "@alias/shared/mafia";
import { SKIP_VOTE } from "@alias/shared/mafia";
import Announce from "./Announce";
import PhaseHead, { fmtClock } from "./PhaseHead";
import PlayerCard, { PlayerGrid, ChoiceChip } from "./PlayerCard";
import MafiaAvatar from "./MafiaAvatar";
import { RoleChip, ROLE_META } from "./roleMeta";

/** Короткая подпись роли под именем погибшего. */
const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(ROLE_META).map(([k, v]) => [k, v.label]),
);

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
//
// Сетка та же, что в голосовании, только карточки не нажимаются: экран, на
// котором говорят вслух, и экран, на котором выбирают, должны выглядеть одним
// столом. Погибшие остаются на своих местах приглушёнными — разговор идёт и
// про них тоже.
export function DiscussionScreen({
  view,
  onSkip,
}: {
  view: MafiaView;
  /** «Пропустить обсуждение» — переключатель, общий для всех живых. */
  onSkip: () => void;
}) {
  const skip = view.discussionSkip;
  const mates = new Set(view.you.partnerIds ?? []);
  return (
    <>
      <PhaseHead
        icon={MessagesSquare}
        title={view.day === 0 ? "Знакомство" : `День ${view.day} — обсуждение`}
      />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0 8px" }}>
        <div className="mf-timer" style={{ fontSize: 64, lineHeight: 1 }}>{fmtClock(view.timer?.msLeft ?? 0)}</div>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--mf-text-faint)", marginTop: 6 }}>
          {view.day === 0
            ? "Познакомьтесь и договоритесь — этим днём никого не изгоняют"
            : "Говорите голосом — телефон подождёт"}
        </div>
      </div>

      <PlayerGrid count={view.players.length}>
        {view.players.map((p) => (
          <PlayerCard
            key={p.userId}
            name={p.displayName}
            avatarIdx={p.avatarIdx}
            me={p.userId === view.you.userId}
            dead={!p.alive}
            offline={!p.online}
            disabled
            subline={
              !p.alive && p.role ? (
                <span style={{ color: "var(--mf-text-faint)" }}>{ROLE_LABEL[p.role]}</span>
              ) : mates.has(p.userId) ? (
                <span style={{ color: "var(--mf-crimson)" }}>напарник</span>
              ) : undefined
            }
          />
        ))}
      </PlayerGrid>

      <div style={{ padding: "12px 20px 22px" }}>
        {/* Обсуждение кончают все вместе. Прежде это была кнопка хоста — и
            стол вставал до таймера, стоило хосту погибнуть или пропасть. */}
        {view.you.alive && !view.you.isSpectator && skip ? (
          <button
            type="button"
            className="mf-btn mf-btn-ghost mf-skip-vote"
            data-mine={skip.mine ? "" : undefined}
            onClick={onSkip}
          >
            <span>Пропустить обсуждение</span>
            <span className="mf-mono mf-skip-count" data-lead={skip.count >= skip.total ? "" : undefined}>
              {skip.count}/{skip.total}
            </span>
          </button>
        ) : (
          <div className="mf-mono" style={{ textAlign: "center", fontSize: 13, color: "var(--mf-text-faint)", fontWeight: 700 }}>
            {skip ? `пропустить готовы ${skip.count} из ${skip.total}` : ""}
          </div>
        )}
      </div>
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
  const skipVotes = tally?.[SKIP_VOTE] ?? 0;
  // Своих мафия видит и днём: ночью подпись есть, а днём её не было, хотя
  // знание то же самое и утекать ему некуда — вид собирается на каждый сокет.
  const mates = new Set(you.partnerIds ?? []);

  return (
    <>
      <PhaseHead icon={Vote} title={`День ${view.day} — голосование`} timerMs={view.timer?.msLeft ?? null} />
      <div style={{ padding: "8px 20px 16px" }}>
        <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: "-0.02em" }}>
          {round2 ? "Голоса разделились" : "Кто мафия?"}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--mf-text-dim)", marginTop: 4 }}>
          {round2 ? "Голосовать можно только за них" : "Голос можно менять, пока идёт таймер"}
        </div>
      </div>
      <PlayerGrid count={alive.length}>
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
              offline={!p.online}
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
              choice={
                mine ? (
                  <ChoiceChip color="var(--mf-crimson)">
                    <Check size={12} /> твой голос
                  </ChoiceChip>
                ) : undefined
              }
              subline={
                mates.has(p.userId) ? (
                  <span style={{ color: "var(--mf-crimson)" }}>напарник</span>
                ) : undefined
              }
            />
          );
        })}
      </PlayerGrid>
      {view.settings.rules.allowSkipVote && (
        <div style={{ padding: "14px 20px 22px" }}>
          <button
            type="button"
            className="mf-btn mf-btn-ghost mf-skip-vote"
            data-mine={you.voted === SKIP_VOTE ? "" : undefined}
            onClick={() => onVote(you.voted === SKIP_VOTE ? null : SKIP_VOTE)}
          >
            {/* Текст постоянный: подпись, скачущая под пальцем, читается как
                другая кнопка. Что голос твой, видно по подсветке и счётчику. */}
            <span>Никого не изгонять</span>
            {/* Голоса за скип видны так же, как за игроков: иначе город не
                понимает, набирается ли большинство. */}
            {skipVotes > 0 && (
              <span
                className="mf-mono mf-skip-count"
                data-lead={skipVotes === max && max > 0 ? "" : undefined}
              >
                {skipVotes}
              </span>
            )}
          </button>
        </div>
      )}
    </>
  );
}

// ─────────── Итог голосования ───────────
export function VoteResultScreen({ view }: { view: MafiaView }) {
  const sp = view.spotlight?.[0];
  const tie = view.vote?.tie && !view.vote?.eliminated;
  if (view.vote?.skipped) {
    return (
      <Announce
        icon={Scale}
        iconColor="var(--mf-text-dim)"
        kicker="Голосование окончено"
        title="Город решил никого не изгонять"
        footer={
          <div className="mf-mono" style={{ textAlign: "center", fontSize: 13, color: "var(--mf-text-faint)", fontWeight: 700 }}>
            ночь начнётся скоро
          </div>
        }
      />
    );
  }
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
