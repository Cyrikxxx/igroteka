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
import type { MafiaView, MafiaNightAction } from "@igroteka/shared/mafia";
import PhaseHead from "./PhaseHead";
import PlayerCard, { PlayerGrid, ChoiceChip } from "./PlayerCard";
import { SheriffConfirm, SheriffVerdict } from "./SheriffCheck";
import NarrationCaption from "./NarrationCaption";

/**
 * Кнопка «Подтвердить» под сеткой.
 *
 * Второй шаг после тапа по игроку. Раньше ход засчитывался сразу, и это
 * стоило трёх неприятностей: случайное касание становилось ходом; передумать
 * было нельзя; а шериф, ходивший последним, не успевал прочитать результат
 * проверки — ночь обрывалась ровно в момент его тапа.
 */
function ConfirmBar({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  return (
    <div style={{ padding: "6px 20px 14px" }}>
      <button type="button" className="mf-btn mf-btn-crimson" onClick={onConfirm}>
        <Check size={17} /> {label}
      </button>
    </div>
  );
}

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

/**
 * Экран того, кто сейчас спит. В режиме ведущего его видят все, кроме
 * вызванной роли: ни сетки, ни таймера, ни намёка на то, чей идёт шаг.
 */
export function NightHush({ day }: { day: number }) {
  return (
    <>
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
        <div style={{ fontWeight: 800, fontSize: 32, letterSpacing: "-0.02em" }}>
          Глаза закрыты
        </div>
        <div style={{ fontWeight: 600, fontSize: 15.5, color: "var(--mf-text-dim)", lineHeight: 1.5 }}>
          Ночь {day}. Слушай ведущего —
          <br />
          он назовёт, когда просыпаться.
        </div>
      </div>
      {/* Этот экран страница рисует и сама — зрителям и выбывшим ночью, —
          поэтому плашка живёт здесь, а не у мест вызова. */}
      <NarrationCaption />
    </>
  );
}

export default function NightScreen({
  view,
  onAction,
  onConfirm,
  menu,
}: {
  view: MafiaView;
  onAction: (action: MafiaNightAction, targetId: string | null) => void;
  /** Зафиксировать выбор. Без ведущего ночь ждёт подтверждения каждого. */
  onConfirm: () => void;
  /** Служебное меню партии: стоит в шапке фазы, рядом с таймером. */
  menu?: ReactNode;
}) {
  const you = view.you;
  const role = you.role;
  const alive = view.players.filter((p) => p.alive);
  const t = view.timer?.msLeft ?? null;
  const acted = you.nightTarget != null;

  // Состояние проверки шерифа. Хуки — до всех ранних возвратов.
  const [pending, setPending] = useState<{ userId: string; name: string; avatarIdx: number } | null>(null);
  const [verdictClosed, setVerdictClosed] = useState<string | null>(null);

  // ─── Режим ведущего ───
  // Ночь идёт по шагам: сетка живая только в своё окно хода. Пока ведущий
  // называет роль и пока идёт тишина после хода — тапать нельзя, сервер
  // такой ход всё равно отклонит.
  const night = view.night;
  const locked = Boolean(night && night.stage !== "act");

  // Без ведущего выбор надо зафиксировать: тап только намечает цель.
  // С ведущим шага нет — там темп задаёт он, и подтверждать нечего.
  const confirmed = you.nightConfirmed === true;
  const needsConfirm = !night && acted && !confirmed;
  const progress = you.nightConfirmProgress;

  const hint = (prompt: string): string => {
    if (night?.stage === "announce") return "Слушай ведущего…";
    if (night?.stage === "gap") return "Ход принят. Закрывай глаза";
    if (night) return acted ? "Ход принят" : prompt;
    if (confirmed) {
      return progress && progress.done < progress.total
        ? `Ход принят. Ждём остальных — ${progress.done} из ${progress.total}`
        : "Ход принят. Ждём остальных…";
    }
    if (acted) return "Нажми «Подтвердить», чтобы зафиксировать";
    return prompt;
  };

  // Зовут не тебя — темнота. Ни таймера, ни имён: по ним и вычисляют, кто
  // ходит и жива ли роль.
  if (night && !night.yourTurn) {
    return (
      <>
        <PhaseHead menu={menu} icon={Moon} title={`Ночь ${view.day}`} />
        <NightHush day={view.day} />
      </>
    );
  }

  // ─── Мирный (или без ночной роли) ───
  if (!role || role === "civilian") {
    return (
      <>
        <PhaseHead menu={menu} icon={Moon} title={`Ночь ${view.day}`} timerMs={t} />
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
        <NarrationCaption />
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
        <PhaseHead menu={menu} icon={Moon} title={`Ночь ${view.day}`} timerMs={t} />
        <div style={{ padding: "6px 20px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--mf-text-dim)" }}>
            Выбери, кого мафия уберёт этой ночью
          </div>
          {view.settings.roles.don ? (
            <div className="mf-chip" style={{ alignSelf: "flex-start", background: "rgba(225,29,72,0.12)", color: "var(--role-don)" }}>
              <Crown size={14} /> Голоса разделились — решает Дон
            </div>
          ) : null}
        </div>
        <PlayerGrid count={alive.length}>
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
                offline={!p.online}
                picked={picked}
                disabled={ally || locked}
                onClick={() => onAction("mafia", picked ? null : p.userId)}
                subline={
                  isPartner ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--mf-crimson)" }}>
                      <VenetianMask size={13} /> напарник
                    </span>
                  ) : undefined
                }
                choice={picked ? <ChoiceChip color="var(--role-mafia)">твой голос</ChoiceChip> : undefined}
                badgeTopRight={voters ? chip(`${voters.join(", ")} ✓`, "rgba(225,29,72,0.2)", "var(--mf-crimson-hover)") : undefined}
              />
            );
          })}
        </PlayerGrid>
        {needsConfirm ? <ConfirmBar label="Подтвердить жертву" onConfirm={onConfirm} /> : null}
        <NarrationCaption />
        <StatusBar icon={acted ? Check : MousePointerClick} color={acted ? "var(--mf-crimson)" : undefined}>
          {hint("Тапни по игроку, чтобы проголосовать")}
        </StatusBar>
      </>
    );
  }

  // ─── Доктор ───
  if (role === "doctor") {
    return (
      <>
        <PhaseHead menu={menu} icon={HeartPulse} title={`Ночь ${view.day}`} timerMs={t} />
        <div style={{ padding: "6px 20px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--mf-text-dim)" }}>
            Кого будешь лечить этой ночью?
          </div>
          <div className="mf-chip" style={{ alignSelf: "flex-start", background: "rgba(56,189,248,0.12)", color: "var(--role-doctor)" }}>
            <HeartPulse size={14} /> Самолечение: осталось {you.doctorSelfHealUsed ? 0 : 1}
          </div>
        </div>
        <PlayerGrid count={alive.length}>
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
                offline={!p.online}
                picked={picked}
                disabled={disabled || locked}
                onClick={() => onAction("doctor", picked ? null : p.userId)}
                subline={
                  prev ? (
                    <span style={{ color: "var(--mf-text-faint)" }}>лечил прошлой ночью</span>
                  ) : undefined
                }
                choice={picked ? <ChoiceChip color="var(--role-doctor)">лечишь</ChoiceChip> : undefined}
              />
            );
          })}
        </PlayerGrid>
        {needsConfirm ? <ConfirmBar label="Подтвердить лечение" onConfirm={onConfirm} /> : null}
        <NarrationCaption />
        <StatusBar icon={acted ? Check : MousePointerClick} color={acted ? "var(--role-doctor)" : undefined}>
          {hint("Тапни по игроку, чтобы вылечить")}
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
        <PhaseHead menu={menu} icon={Search} title={`Ночь ${view.day}`} timerMs={t} gold />
        <div style={{ padding: "6px 20px 14px" }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--mf-text-dim)" }}>
            Кого проверишь этой ночью?
          </div>
        </div>
        <PlayerGrid count={alive.length}>
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
                offline={!p.online}
                picked={picked}
                gold
                // Проверка необратима, поэтому после хода сетка блокируется.
                disabled={isMe || acted || locked}
                onClick={() =>
                  setPending({ userId: p.userId, name: p.displayName, avatarIdx: p.avatarIdx })
                }
                subline={
                  known !== undefined ? (
                    <span style={{ fontWeight: 800, color: known ? "var(--mf-crimson)" : "var(--mf-text-dim)" }}>
                      {known ? "МАФИЯ" : "не мафия"}
                    </span>
                  ) : undefined
                }
                choice={picked ? <ChoiceChip color="var(--role-sheriff)">проверяешь</ChoiceChip> : undefined}
              />
            );
          })}
        </PlayerGrid>
        <NarrationCaption />
        <StatusBar icon={acted ? Check : MousePointerClick} color={acted ? "var(--mf-gold)" : undefined}>
          {hint("Тапни по игроку, чтобы проверить")}
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
            onClose={() => {
              setVerdictClosed(target);
              // Закрыл вердикт — значит прочитал. Это и есть подтверждение
              // хода шерифа: до него ночь не закончится, даже если он
              // сходил последним. Раньше она обрывалась на его тапе, и
              // результат проверки он так и не видел.
              if (!night) onConfirm();
            }}
          />
        ) : null}
      </>
    );
  }

  // ─── Маньяк ───
  return (
    <>
      <PhaseHead menu={menu} icon={Skull} title={`Ночь ${view.day}`} timerMs={t} />
      <div style={{ padding: "6px 20px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--mf-text-dim)" }}>
          Выбери жертву этой ночи
        </div>
        <div className="mf-chip" style={{ alignSelf: "flex-start", background: "rgba(168,85,247,0.13)", color: "var(--role-maniac)" }}>
          <Skull size={14} /> Ты играешь сам за себя
        </div>
      </div>
      <PlayerGrid count={alive.length}>
        {alive.map((p) => {
          const isMe = p.userId === you.userId;
          const picked = you.nightTarget === p.userId;
          return (
            <PlayerCard
              key={p.userId}
              name={p.displayName}
              avatarIdx={p.avatarIdx}
              me={isMe}
              offline={!p.online}
              picked={picked}
              disabled={isMe || locked}
              onClick={() => onAction("maniac", picked ? null : p.userId)}
              choice={picked ? <ChoiceChip color="var(--role-maniac)">жертва</ChoiceChip> : undefined}
            />
          );
        })}
      </PlayerGrid>
      {needsConfirm ? <ConfirmBar label="Подтвердить жертву" onConfirm={onConfirm} /> : null}
      <NarrationCaption />
      <StatusBar icon={acted ? Check : MousePointerClick} color={acted ? "var(--role-maniac)" : undefined}>
        {hint("Тапни по игроку")}
      </StatusBar>
    </>
  );
}
