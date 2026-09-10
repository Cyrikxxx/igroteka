"use client";

// Итоги завершённой партии Мафии.
//
// Тот же финал, что виден в комнате, но живёт он не в Redis, а в Postgres —
// и потому доступен, когда комнаты давно нет. Раньше кнопка «Итоги» в истории
// вела на саму историю: экрана не было вовсе, хотя сохранялось всё нужное.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Shield, Skull, VenetianMask } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MafiaResultGame } from "@/app/api/mafia/games/[id]/route";
import MafiaShell from "@/components/mafia/MafiaShell";
import MafiaAvatar from "@/components/mafia/MafiaAvatar";
import { RoleChip } from "@/components/mafia/roleMeta";
import { Chronicle } from "@/components/mafia/Chronicle";
import { createMafiaRoomLike } from "@/lib/rematch";
import { fateText } from "@/lib/mafia-fate";

const WIN_META: Record<
  "CITY" | "MAFIA" | "MANIAC",
  { title: string; color: string; Icon: LucideIcon }
> = {
  CITY: { title: "Победа города", color: "var(--alias-green)", Icon: Shield },
  MAFIA: { title: "Победа мафии", color: "var(--mf-crimson)", Icon: VenetianMask },
  MANIAC: { title: "Победа маньяка", color: "var(--role-maniac)", Icon: Skull },
};

export default function MafiaResultsPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? "");
  const [game, setGame] = useState<MafiaResultGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/mafia/games/${id}`)
      .then(async (r) => {
        if (r.status === 403) throw new Error("Это итоги чужой партии");
        if (!r.ok) throw new Error("Партия не найдена");
        return (await r.json()) as MafiaResultGame;
      })
      .then(setGame)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const again = async () => {
    if (!game || busy) return;
    setBusy(true);
    try {
      const code = await createMafiaRoomLike(game.settings);
      router.push(`/mafia/room/${code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (error) {
    return (
      <MafiaShell>
        <Centered text={error} onBack={() => router.push("/history")} />
      </MafiaShell>
    );
  }
  if (!game) {
    return (
      <MafiaShell>
        <Centered text="Загрузка…" />
      </MafiaShell>
    );
  }

  const m = WIN_META[game.winner ?? "CITY"];
  const Icon = m.Icon;
  const days = game.dayCount;

  return (
    <MafiaShell wide vignette vignetteLevel={0.06}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "38px 24px 20px", textAlign: "center" }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.04)",
            border: `1.5px solid ${m.color}`,
            color: m.color,
            boxShadow: `0 0 44px ${m.color}`,
          }}
        >
          <Icon size={46} strokeWidth={1.5} />
        </div>
        <div className="mf-mono" style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mf-text-faint)" }}>
          {days} {days === 1 ? "ночь" : days < 5 ? "ночи" : "ночей"} · {game.players.length} игроков
        </div>
        <div style={{ fontWeight: 800, fontSize: 36, letterSpacing: "-0.02em", color: m.color, lineHeight: 1.05 }}>
          {m.title}
        </div>
      </div>

      <div className="mf-finale-body">
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <SectionLabel>Кто кем был</SectionLabel>
          {game.players.map((p, i) => (
            <div
              key={`${p.name}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "var(--mf-surface)",
                // Свою строку подсвечиваем: в составе из десяти человек глаз
                // иначе ищет себя по имени.
                border: `1px solid ${p.you ? "var(--mf-crimson)" : "var(--mf-border)"}`,
                borderRadius: 14,
                padding: "9px 12px",
              }}
            >
              <MafiaAvatar name={p.name} idx={i} size={36} dead={!p.alive} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                  {p.name}
                  {p.you ? <span style={{ color: "var(--mf-text-faint)", fontWeight: 600 }}> · ты</span> : null}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--mf-text-faint)" }}>
                  {fateText(p.eliminatedBy, p.deathDay)}
                </div>
              </div>
              <RoleChip role={p.role} />
            </div>
          ))}
        </div>

        {game.events.length > 0 ? (
          <div>
            <SectionLabel style={{ margin: "4px 0 10px" }}>Хроника партии</SectionLabel>
            <Chronicle events={game.events} />
          </div>
        ) : null}
      </div>

      <div style={{ padding: "14px 20px 24px", display: "flex", gap: 10 }}>
        <button
          type="button"
          className="mf-btn mf-btn-ghost"
          style={{ minWidth: 64, padding: "0 16px" }}
          onClick={() => router.push("/history")}
          aria-label="К истории"
        >
          <ArrowLeft size={18} />
        </button>
        <button
          type="button"
          className="mf-btn mf-btn-crimson"
          style={{ flex: 1 }}
          onClick={again}
          disabled={busy}
        >
          <RotateCcw size={18} /> Сыграть так же
        </button>
      </div>
    </MafiaShell>
  );
}

function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: "var(--mf-text-faint)",
        marginBottom: 2,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Centered({ text, onBack }: { text: string; onBack?: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "0 32px", textAlign: "center" }}>
      <p style={{ color: "var(--mf-text-faint)", fontWeight: 600 }}>{text}</p>
      {onBack ? (
        <button type="button" className="mf-btn mf-btn-surface" onClick={onBack}>
          <ArrowLeft size={17} /> К истории
        </button>
      ) : null}
    </div>
  );
}
