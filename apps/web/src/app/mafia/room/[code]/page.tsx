"use client";

// Лобби комнаты Мафии. Код + список игроков + старт. Хост: настройки, кик.
// Когда партия начинается (phase != LOBBY) — уводим на /play.

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Copy, Crown, DoorClosed, DoorOpen, Link2, LogOut, Pencil, Settings2, Unlock, VenetianMask, X } from "lucide-react";
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
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useMafiaRoom } from "@/hooks/useMafiaRoom";
import { loadRoomCreds, clearRoomCreds, saveDisplayName, type RoomCredentials } from "@/lib/room-session";
import { resumeRoom } from "@/lib/room-resume";
import { setRoomNotice } from "@/lib/room-notice";

export default function MafiaLobbyPage() {
  const router = useRouter();
  const params = useParams();
  const code = String(params.code ?? "").toUpperCase();

  // Креды читаем в эффекте, а не при рендере: sessionStorage на сервере нет,
  // и обращение к нему в теле компонента разъезжалось с серверной разметкой —
  // на гидратации React ругался на несовпадение.
  const [creds, setCreds] = useState<RoomCredentials | null>(null);
  const opts = useMemo(
    () =>
      creds
        ? { wsUrl: creds.wsUrl, token: creds.wsToken, code: creds.code, name: creds.displayName }
        : null,
    [creds],
  );

  const { socket, view, error, closedReason } = useMafiaRoom(opts);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [closeAsk, setCloseAsk] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState<MafiaSettings | null>(null);

  // Креды живут во вкладке и умирают вместе с ней, а человек в комнате — нет.
  // Поэтому сначала пробуем вернуться молча, и только если сервер не узнал —
  // отправляем на экран входа.
  useEffect(() => {
    if (!code) return;
    const stored = loadRoomCreds(code);
    if (stored) {
      setCreds(stored);
      return;
    }
    let alive = true;
    resumeRoom(code, "mafia").then((resumed) => {
      if (!alive) return;
      if (resumed) setCreds(resumed);
      else router.replace(`/mafia/join?code=${code}`);
    });
    return () => {
      alive = false;
    };
  }, [code, router]);

  // Выгнали или комнату закрыли — уводим на главный экран Мафии и объясняем
  // там, что случилось. Раньше интерфейс комнаты оставался на месте, и любое
  // переподключение возвращало человека обратно.
  useEffect(() => {
    if (!closedReason || !code) return;
    clearRoomCreds(code);
    setRoomNotice({ text: closedReason, tone: "danger" });
    router.replace("/mafia");
  }, [closedReason, code, router]);

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

  // Своя запись — источник актуального ника: его мог поменять и сам игрок,
  // и другая вкладка.
  const me = players.find((p) => p.userId === view?.you.userId) ?? null;
  const myName = me?.displayName ?? creds.displayName;

  const commitMyName = (input: HTMLInputElement) => {
    const next = input.value.trim().slice(0, 50);
    setEditingName(false);
    if (!next || next === myName) return;
    socket?.emit("mafia:set_name", { displayName: next }, () => {});
    // Запоминаем и глобально: следующий вход подставит новое имя сам.
    saveDisplayName(next);
  };
  const enough = count >= MIN_MAFIA_PLAYERS;
  const settings = view?.settings;
  const comp = settings ? computeComposition(Math.max(count, MIN_MAFIA_PLAYERS), settings) : null;

  const inviteUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/mafia/join?code=${code}`;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  // Как в лобби Алиаса: просто кладём ссылку в буфер. Системная шторка
  // «Поделиться» перекрывала лобби, а на десктопе всё равно сводилась к буферу.
  const shareLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1600);
    } catch {}
  };

  const start = () => socket?.emit("mafia:start", {}, () => {});
  // Кик и передача хоста обратимы, поэтому делаются сразу: лишний вопрос на
  // каждое нажатие только мешал.
  const kick = (userId: string) => socket?.emit("mafia:kick", { userId }, () => {});
  const unban = (userId: string) => socket?.emit("mafia:unban", { userId }, () => {});
  const makeHost = (userId: string) =>
    socket?.emit("mafia:transfer_host", { userId }, () => {});
  const leave = () => {
    socket?.emit("mafia:leave", {}, () => {});
    clearRoomCreds(code);
    router.replace("/");
  };
  // Закрытие комнаты — отдельное осознанное действие, а не побочный эффект
  // выхода. Раньше кнопка выхода у хоста делала именно это: он уходил — и
  // комната разваливалась под всеми остальными.
  const closeRoom = () => {
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
        <div style={{ display: "flex", gap: 2 }}>
          {/* Закрыть комнату для всех — только у хоста и только отдельной
              кнопкой. Обычный выход комнату не рушит: она достаётся
              следующему, кто на связи. */}
          {isHost ? (
            <button
              type="button"
              onClick={() => setCloseAsk(true)}
              style={{ background: "none", border: "none", color: "var(--mf-text-faint)", cursor: "pointer", display: "flex", padding: 4 }}
              aria-label="Закрыть комнату"
              title="Закрыть комнату для всех"
            >
              <DoorClosed size={20} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={leave}
            style={{ background: "none", border: "none", color: "var(--mf-text-faint)", cursor: "pointer", display: "flex", padding: 4 }}
            aria-label="Выйти"
            title={isHost ? "Выйти — комната перейдёт другому" : "Выйти"}
          >
            <LogOut size={20} />
          </button>
        </div>
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
            {copied ? "Скопировано" : "Код"}
          </button>
          <button type="button" className="mf-chip" style={{ border: "none", cursor: "pointer", padding: "8px 14px", fontSize: 13, color: "var(--mf-text)" }} onClick={shareLink}>
            {linkCopied ? <Check size={15} /> : <Link2 size={15} />}
            {linkCopied ? "Скопировано" : "Ссылка"}
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
                {/* Своё имя правится прямо здесь, по карандашу рядом с ним —
                    искать отдельное поле где-то ещё не нужно. */}
                {p.userId === view?.you.userId && editingName ? (
                  <input
                    autoFocus
                    defaultValue={myName}
                    maxLength={50}
                    onBlur={(e) => commitMyName(e.target)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") {
                        e.currentTarget.value = myName;
                        e.currentTarget.blur();
                      }
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: "var(--mf-bg)",
                      border: "1px solid var(--mf-crimson)",
                      borderRadius: 10,
                      outline: "none",
                      color: "var(--mf-text)",
                      fontWeight: 700,
                      fontSize: 15.5,
                      padding: "5px 9px",
                    }}
                  />
                ) : (
                  <span style={{ fontWeight: 700, fontSize: 15.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.displayName}
                    {p.userId === view?.you.userId ? " (ты)" : ""}
                  </span>
                )}
                {p.isHost ? <Crown size={16} color="var(--mf-gold)" /> : null}
                {p.userId === view?.you.userId && !editingName ? (
                  <button
                    type="button"
                    aria-label="Изменить своё имя"
                    title="Изменить имя"
                    onClick={() => setEditingName(true)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mf-text-faint)", display: "flex", padding: 4, flexShrink: 0 }}
                  >
                    <Pencil size={15} />
                  </button>
                ) : null}
              </div>
              {isHost && !p.isHost ? (
                <div style={{ display: "flex", gap: 2 }}>
                  <button
                    type="button"
                    aria-label={`Передать комнату — ${p.displayName}`}
                    title="Сделать хостом"
                    onClick={() => makeHost(p.userId)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mf-text-faint)", display: "flex", padding: 6 }}
                  >
                    <Crown size={17} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Выгнать ${p.displayName}`}
                    title="Выгнать"
                    onClick={() => kick(p.userId)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mf-text-faint)", display: "flex", padding: 6 }}
                  >
                    <X size={17} />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Заблокированные — только хосту: кик обратим, комнату пересоздавать
          не надо. Разблокировка лишь открывает вход: обратно человек заходит
          сам, по коду или ссылке. */}
      {isHost && (view?.banned?.length ?? 0) > 0 ? (
        <div style={{ padding: "4px 20px 0" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--mf-text-faint)", marginBottom: 8 }}>
            Заблокированные ({view?.banned?.length}) · видно только тебе
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {view?.banned?.map((b) => (
              <div
                key={b.userId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "var(--mf-surface)",
                  border: "1px solid var(--mf-border)",
                  borderRadius: "var(--r-btn)",
                  padding: "8px 12px",
                }}
              >
                <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: "var(--mf-text-dim)" }}>
                  {b.displayName}
                </span>
                <button
                  type="button"
                  className="mf-btn mf-btn-ghost"
                  style={{ minHeight: 36, padding: "0 14px", fontSize: 14 }}
                  onClick={() => unban(b.userId)}
                >
                  <Unlock size={15} /> Разблокировать
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

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

      <ConfirmDialog
        open={closeAsk}
        variant="mafia"
        title="Закрыть комнату?"
        text="Все игроки выйдут из неё. Вернуться в эту комнату будет нельзя."
        confirmLabel="Закрыть"
        onConfirm={() => {
          setCloseAsk(false);
          closeRoom();
        }}
        onCancel={() => setCloseAsk(false)}
      />
    </MafiaShell>
  );
}
