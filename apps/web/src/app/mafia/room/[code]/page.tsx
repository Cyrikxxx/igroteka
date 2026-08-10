"use client";

// Лобби комнаты Мафии. Код + список игроков + старт. Хост: настройки, кик.
// Когда партия начинается (phase != LOBBY) — уводим на /play.

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Copy, Crown, DoorOpen, LogOut, Settings2, Share2, VenetianMask, X, Check } from "lucide-react";
import {
  MIN_MAFIA_PLAYERS,
  MAX_MAFIA_PLAYERS,
  computeComposition,
  describeComposition,
  type MafiaSettings,
} from "@alias/shared/mafia";
import MafiaShell from "@/components/mafia/MafiaShell";
import MafiaAvatar from "@/components/mafia/MafiaAvatar";
import MafiaSettingsForm from "@/components/mafia/MafiaSettingsForm";
import QrCode from "@/components/common/QrCode";
import { useMafiaRoom } from "@/hooks/useMafiaRoom";
import { loadRoomCreds, clearRoomCreds } from "@/lib/room-session";

export default function MafiaLobbyPage() {
  const router = useRouter();
  const params = useParams();
  const code = String(params.code ?? "").toUpperCase();

  const creds = useMemo(() => (code ? loadRoomCreds(code) : null), [code]);
  const opts = useMemo(
    () =>
      creds
        ? { wsUrl: creds.wsUrl, token: creds.wsToken, code: creds.code, name: creds.displayName }
        : null,
    [creds],
  );

  const { socket, view, error } = useMafiaRoom(opts);
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<MafiaSettings | null>(null);

  // Нет креды в сессии — на экран входа.
  useEffect(() => {
    if (code && !creds) router.replace(`/mafia/join?code=${code}`);
  }, [code, creds, router]);

  // Партия началась — на игровой экран.
  useEffect(() => {
    if (view && view.phase !== "LOBBY") {
      router.replace(`/mafia/room/${code}/play`);
    }
  }, [view, code, router]);

  if (!creds) return <MafiaShell><div /></MafiaShell>;

  const isHost = view?.you.isHost ?? false;
  const players = view?.players ?? [];
  const count = players.length;
  const enough = count >= MIN_MAFIA_PLAYERS;
  const settings = view?.settings;
  const comp = settings ? computeComposition(Math.max(count, MIN_MAFIA_PLAYERS), settings) : null;

  const inviteUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/mafia/join?code=${code}`;

  const copyCode = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };
  const shareLink = () => {
    if (navigator.share)
      navigator.share({ title: "Мафия", text: "Заходи в комнату", url: inviteUrl }).catch(() => {});
    else navigator.clipboard?.writeText(inviteUrl);
  };

  const start = () => socket?.emit("mafia:start", {}, () => {});
  const kick = (userId: string) => socket?.emit("mafia:kick", { userId }, () => {});
  const leave = () => {
    socket?.emit("mafia:leave", {}, () => {});
    clearRoomCreds(code);
    router.replace("/");
  };
  // Хост уходит не один: комната без него всё равно никому не нужна,
  // поэтому спрашиваем и закрываем её для всех.
  const closeRoom = () => {
    if (!window.confirm("Закрыть комнату? Все игроки выйдут из неё.")) return;
    socket?.emit("mafia:close", {}, () => {});
    clearRoomCreds(code);
    router.replace("/");
  };
  const saveSettings = () => {
    if (draft) socket?.emit("mafia:settings", draft, () => {});
    setSettingsOpen(false);
  };

  return (
    <MafiaShell wide>
      <div className="mf-phase-head">
        <div className="mf-phase-title">
          <DoorOpen size={21} color="var(--mf-crimson)" />
          <span>Лобби</span>
        </div>
        <button
          type="button"
          onClick={isHost ? closeRoom : leave}
          style={{ background: "none", border: "none", color: "var(--mf-text-faint)", cursor: "pointer", display: "flex", padding: 4 }}
          aria-label={isHost ? "Закрыть комнату" : "Выйти"}
          title={isHost ? "Закрыть комнату" : "Выйти"}
        >
          <LogOut size={20} />
        </button>
      </div>

      <div className="mf-lobby-grid">
      {/* Код комнаты */}
      <div className="mf-lobby-code" style={{ padding: "18px 20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--mf-text-faint)", textTransform: "uppercase" }}>
          Код комнаты
        </div>
        <div className="mf-mono mf-lobby-code-value" style={{ fontWeight: 700, letterSpacing: "0.22em", marginLeft: "0.22em", lineHeight: 1 }}>
          {code}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="mf-chip" style={{ border: "none", cursor: "pointer", padding: "8px 14px", fontSize: 13, color: "var(--mf-text)" }} onClick={copyCode}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Скопировано" : "Скопировать"}
          </button>
          <button type="button" className="mf-chip" style={{ border: "none", cursor: "pointer", padding: "8px 14px", fontSize: 13, color: "var(--mf-text)" }} onClick={shareLink}>
            <Share2 size={15} />
            Поделиться
          </button>
        </div>
        {/* QR удобен, когда компания рядом: навёл камеру — и ты в комнате. */}
        <div className="mf-lobby-qr">
          <QrCode value={inviteUrl} />
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--mf-text-faint)", textAlign: "center", marginTop: 10 }}>
            Наведи камеру телефона,
            <br />
            чтобы войти в комнату
          </div>
        </div>
      </div>

      <div className="mf-lobby-right">
      {/* Игроки */}
      <div style={{ padding: "22px 20px 0", flex: 1, display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>Игроки</span>
          <span className="mf-mono" style={{ fontSize: 13.5, color: "var(--mf-text-dim)", fontWeight: 700 }}>
            {count} / {MAX_MAFIA_PLAYERS}
            {/* Зрители сидят в комнате, но в списке их не видно —
                без счётчика непонятно, куда делся зашедший человек. */}
            {view && view.spectatorCount > 0 ? (
              <span style={{ color: "var(--mf-text-faint)" }}> · {view.spectatorCount} зрит.</span>
            ) : null}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {players.map((p) => (
            <div
              key={p.userId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "var(--mf-surface)",
                border: "1px solid var(--mf-border)",
                borderRadius: 16,
                padding: "10px 12px",
              }}
            >
              <div style={{ position: "relative" }}>
                <MafiaAvatar name={p.displayName} idx={p.avatarIdx} size={40} />
                <div
                  style={{
                    position: "absolute",
                    right: -1,
                    bottom: -1,
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    background: p.online ? "#34d399" : "#62636e",
                    border: "2px solid var(--mf-bg)",
                  }}
                />
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 15.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.displayName}
                  {p.userId === view?.you.userId ? " (ты)" : ""}
                </span>
                {p.isHost ? <Crown size={16} color="var(--mf-gold)" /> : null}
              </div>
              {isHost && !p.isHost ? (
                <button
                  type="button"
                  aria-label="Удалить"
                  onClick={() => kick(p.userId)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mf-text-faint)", display: "flex", padding: 6 }}
                >
                  <X size={17} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Состав + действия */}
      <div style={{ padding: "12px 20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
        {comp ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              background: "rgba(225,29,72,0.07)",
              border: "1px solid rgba(225,29,72,0.25)",
              borderRadius: 14,
              padding: "11px 14px",
              fontSize: 13.5,
              fontWeight: 700,
              color: "var(--mf-text-dim)",
              lineHeight: 1.4,
            }}
          >
            <VenetianMask size={18} color="var(--mf-crimson)" style={{ flexShrink: 0 }} />
            {enough ? (
              <span>{count} игроков → <b style={{ color: "var(--mf-text)" }}>{describeComposition(comp)}</b></span>
            ) : (
              <span>{count} игрок(ов) — состав появится от <b style={{ color: "var(--mf-text)" }}>{MIN_MAFIA_PLAYERS} игроков</b></span>
            )}
          </div>
        ) : null}
        {isHost ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="mf-btn mf-btn-ghost"
              style={{ minWidth: 64, padding: "0 16px" }}
              onClick={() => {
                setDraft(settings ?? null);
                setSettingsOpen(true);
              }}
              aria-label="Настройки"
            >
              <Settings2 size={20} />
            </button>
            <button
              type="button"
              className="mf-btn mf-btn-crimson"
              style={{ flex: 1, opacity: enough ? 1 : 0.4, cursor: enough ? "pointer" : "not-allowed" }}
              disabled={!enough}
              onClick={start}
            >
              Начать игру
            </button>
          </div>
        ) : (
          <div className="mf-mono" style={{ textAlign: "center", fontSize: 13, color: "var(--mf-text-faint)", fontWeight: 700 }}>
            {enough ? "Ждём, пока хост начнёт игру" : `Нужно минимум ${MIN_MAFIA_PLAYERS} игроков`}
          </div>
        )}
        {error ? (
          <div style={{ textAlign: "center", color: "var(--mf-crimson)", fontSize: 13, fontWeight: 700 }}>{error}</div>
        ) : null}
      </div>
      </div>
      </div>

      {/* Шит настроек */}
      {settingsOpen && draft ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "rgba(5,5,9,0.6)" }} onClick={() => setSettingsOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--mf-surface)",
              borderRadius: "24px 24px 0 0",
              border: "1px solid var(--mf-border)",
              borderBottom: "none",
              maxHeight: "86dvh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 -16px 48px rgba(0,0,0,0.6)",
              color: "var(--mf-text)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0 0" }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.18)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 0" }}>
              <span style={{ fontWeight: 800, fontSize: 19 }}>Настройки игры</span>
              <button type="button" onClick={() => setSettingsOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mf-text-faint)", display: "flex" }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>
              <MafiaSettingsForm value={draft} onChange={setDraft} playerCount={Math.max(count, MIN_MAFIA_PLAYERS)} />
            </div>
            <div style={{ padding: "12px 20px 18px" }}>
              <button type="button" className="mf-btn mf-btn-crimson" style={{ width: "100%" }} onClick={saveSettings}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </MafiaShell>
  );
}
