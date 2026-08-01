"use client";

// Ночной экран Мафии, зависит от роли смотрящего: мирный спит, мафия/доктор/
// шериф/маньяк выбирают цель. Сетка живых игроков + статус-строка.

import { useState } from "react";
import type { ReactNode } from "react";
import {
  Moon,
  MoonStar,
  HeartPulse,
  Search,
  Skull,
  Crown,
  Check,
  MousePointerClick,
  VenetianMask,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MafiaView, MafiaNightAction } from "@alias/shared/mafia";
import PhaseHead from "./PhaseHead";
import PlayerCard from "./PlayerCard";
import { SheriffConfirm, SheriffVerdict } from "./SheriffCheck";

function StatusBar({
  icon: Icon,
  color,
  children,
}: {
  icon: LucideIcon;
  color?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ padding: "14px 20px 18px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          background: "var(--mf-surface)",
          border: "1px solid var(--mf-border)",
          borderRadius: 14,
          padding: "13px 16px",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--mf-text-dim)",
        }}
      >
        <Icon size={17} color={color} />
        {children}
      </div>
    </div>
  );
}

function chip(text: string, bg: string, color: string): ReactNode {
  return (
    <span className="mf-chip" style={{ background: bg, color, fontSize: 11, padding: "3px 9px" }}>
      {text}
    </span>
  );
}

export default function NightScreen({
  view,
  onAction,
}: {
  view: MafiaView;
  onAction: (action: MafiaNightAction, targetId: string | null) => void;
}) {
  const you = view.you;
  const role = you.role;
  const alive = view.players.filter((p) => p.alive);
  const t = view.timer?.msLeft ?? null;
  const acted = you.nightTarget != null;

  // Состояние проверки шерифа. Хуки — до всех ранних возвратов.
  const [pending, setPending] = useState<{ userId: string; name: string; avatarIdx: number } | null>(null);
  const [verdictClosed, setVerdictClosed] = useState<string | null>(null);

  // ─── Мирный (или без ночной роли) ───
  if (!role || role === "civilian") {
    return (
      <>
        <PhaseHead icon={Moon} title={`Ночь ${view.day}`} timerMs={t} />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            padding: "0 32px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--mf-border)",
              color: "var(--mf-text-dim)",
            }}
          >
            <MoonStar size={44} strokeWidth={1.4} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 32, letterSpacing: "-0.02em" }}>Город спит</div>
          <div style={{ fontWeight: 600, fontSize: 15.5, color: "var(--mf-text-dim)", lineHeight: 1.5 }}>
            Не подглядывай.
            <br />
            Утром узнаешь, что случилось.
          </div>
        </div>
        <StatusBar icon={VenetianMask} color="var(--mf-crimson)">
          город засыпает…
        </StatusBar>
      </>
    );
  }

  // ─── Мафия / Дон ───
  if (role === "mafia" || role === "don") {
    const partnerName = new Map<string, string>();
    (you.partnerIds ?? []).forEach((id, i) =>
      partnerName.set(id, you.partners?.[i] ?? ""),
    );
    const votesByTarget = new Map<string, string[]>(); // targetId -> voterNames
    for (const [voter, target] of Object.entries(you.mafiaVotes ?? {})) {
      if (voter === you.userId) continue;
      const nm = partnerName.get(voter);
      if (!nm) continue;
      votesByTarget.set(target, [...(votesByTarget.get(target) ?? []), nm]);
    }
    return (
      <>
        <PhaseHead icon={Moon} title={`Ночь ${view.day}`} timerMs={t} />
        <div style={{ padding: "6px 20px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--mf-text-dim)" }}>
            Выбери, кого мафия уберёт этой ночью
          </div>
          {view.settings.roles.don ? (
            <div className="mf-chip" style={{ alignSelf: "flex-start", background: "rgba(245,158,11,0.12)", color: "var(--mf-gold)" }}>
              <Crown size={14} /> Дон — решающий голос
            </div>
          ) : null}
        </div>
        <div className="mf-player-grid" style={{ flex: 1, alignContent: "start" }}>
          {alive.map((p) => {
            const isMe = p.userId === you.userId;
            const isPartner = (you.partnerIds ?? []).includes(p.userId);
            const ally = isMe || isPartner;
            const picked = you.nightTarget === p.userId;
            const voters = votesByTarget.get(p.userId);
            return (
              <PlayerCard
                key={p.userId}
                name={p.displayName}
                avatarIdx={p.avatarIdx}
                me={isMe}
                picked={picked}
                disabled={ally}
                onClick={() => onAction("mafia", picked ? null : p.userId)}
                subline={
                  isPartner ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "var(--mf-crimson)" }}>
                      <VenetianMask size={13} /> напарник
                    </div>
                  ) : undefined
                }
                badgeTopRight={picked ? chip("твой голос", "var(--mf-crimson)", "#fff") : undefined}
                badgeTopLeft={voters ? chip(`${voters.join(", ")} ✓`, "rgba(225,29,72,0.2)", "var(--mf-crimson-hover)") : undefined}
              />
            );
          })}
        </div>
        <StatusBar icon={acted ? Check : MousePointerClick} color={acted ? "var(--mf-crimson)" : undefined}>
          {acted ? "Ход принят. Ждём остальных…" : "Тапни по игроку, чтобы проголосовать"}
        </StatusBar>
      </>
    );
  }

  // ─── Доктор ───
  if (role === "doctor") {
    return (
      <>
        <PhaseHead icon={HeartPulse} title={`Ночь ${view.day}`} timerMs={t} />
        <div style={{ padding: "6px 20px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--mf-text-dim)" }}>
            Кого будешь лечить этой ночью?
          </div>
          <div className="mf-chip" style={{ alignSelf: "flex-start", background: "rgba(56,189,248,0.12)", color: "var(--role-doctor)" }}>
            <HeartPulse size={14} /> Самолечение: осталось {you.doctorSelfHealUsed ? 0 : 1}
          </div>
        </div>
        <div className="mf-player-grid" style={{ flex: 1, alignContent: "start" }}>
          {alive.map((p) => {
            const isMe = p.userId === you.userId;
            const prev = p.userId === you.doctorPrevTarget;
            const selfBlocked = isMe && you.doctorSelfHealUsed;
            const disabled = prev || selfBlocked;
            const picked = you.nightTarget === p.userId;
            return (
              <PlayerCard
                key={p.userId}
                name={p.displayName}
                avatarIdx={p.avatarIdx}
                me={isMe}
                picked={picked}
                disabled={disabled}
                onClick={() => onAction("doctor", picked ? null : p.userId)}
                subline={
                  prev ? (
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--mf-text-faint)" }}>лечил прошлой ночью</div>
                  ) : picked ? (
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--role-doctor)" }}>лечишь</div>
                  ) : undefined
                }
              />
            );
          })}
        </div>
        <StatusBar icon={acted ? Check : MousePointerClick} color={acted ? "var(--role-doctor)" : undefined}>
          {acted ? "Ход принят. Ждём остальных…" : "Тапни по игроку, чтобы вылечить"}
        </StatusBar>
      </>
    );
  }

  // ─── Шериф ───
  if (role === "sheriff") {
    const results = you.sheriffResults ?? {};
    const target = you.nightTarget;
    const verdict = target ? results[target] : undefined;
    // Проверка сделана и её результат ещё не отсмотрен — показываем вердикт.
    const showVerdict = target != null && verdict !== undefined && verdictClosed !== target;
    const targetName = alive.find((p) => p.userId === target)?.displayName ?? "Игрок";

    return (
      <>
        <PhaseHead icon={Search} title={`Ночь ${view.day}`} timerMs={t} gold />
        <div style={{ padding: "6px 20px 14px" }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--mf-text-dim)" }}>
            Кого проверишь этой ночью?
          </div>
        </div>
        <div className="mf-player-grid" style={{ flex: 1, alignContent: "start" }}>
          {alive.map((p) => {
            const isMe = p.userId === you.userId;
            const picked = you.nightTarget === p.userId;
            const known = results[p.userId];
            return (
              <PlayerCard
                key={p.userId}
                name={p.displayName}
                avatarIdx={p.avatarIdx}
                me={isMe}
                picked={picked}
                gold
                // Проверка необратима, поэтому после хода сетка блокируется.
                disabled={isMe || acted}
                onClick={() =>
                  setPending({ userId: p.userId, name: p.displayName, avatarIdx: p.avatarIdx })
                }
                subline={
                  known !== undefined ? (
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: known ? "var(--mf-crimson)" : "var(--mf-text-dim)" }}>
                      {known ? "МАФИЯ" : "не мафия"}
                    </div>
                  ) : undefined
                }
              />
            );
          })}
        </div>
        <StatusBar icon={acted ? Check : MousePointerClick} color={acted ? "var(--mf-gold)" : undefined}>
          {acted ? "Ход принят. Ждём остальных…" : "Тапни по игроку, чтобы проверить"}
        </StatusBar>

        {pending ? (
          <SheriffConfirm
            name={pending.name}
            avatarIdx={pending.avatarIdx}
            onCancel={() => setPending(null)}
            onConfirm={() => {
              onAction("sheriff", pending.userId);
              setPending(null);
            }}
          />
        ) : null}

        {showVerdict ? (
          <SheriffVerdict
            name={targetName}
            isMafia={Boolean(verdict)}
            onClose={() => setVerdictClosed(target)}
          />
        ) : null}
      </>
    );
  }

  // ─── Маньяк ───
  return (
    <>
      <PhaseHead icon={Skull} title={`Ночь ${view.day}`} timerMs={t} />
      <div style={{ padding: "6px 20px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--mf-text-dim)" }}>
          Выбери жертву этой ночи
        </div>
        <div className="mf-chip" style={{ alignSelf: "flex-start", background: "rgba(168,85,247,0.13)", color: "var(--role-maniac)" }}>
          <Skull size={14} /> Ты играешь сам за себя
        </div>
      </div>
      <div className="mf-player-grid" style={{ flex: 1, alignContent: "start" }}>
        {alive.map((p) => {
          const isMe = p.userId === you.userId;
          const picked = you.nightTarget === p.userId;
          return (
            <PlayerCard
              key={p.userId}
              name={p.displayName}
              avatarIdx={p.avatarIdx}
              me={isMe}
              picked={picked}
              disabled={isMe}
              onClick={() => onAction("maniac", picked ? null : p.userId)}
              subline={picked ? <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--role-maniac)" }}>жертва</div> : undefined}
            />
          );
        })}
      </div>
      <StatusBar icon={acted ? Check : MousePointerClick} color={acted ? "var(--role-maniac)" : undefined}>
        {acted ? "Ход принят. Ждём остальных…" : "Тапни по игроку"}
      </StatusBar>
    </>
  );
}
