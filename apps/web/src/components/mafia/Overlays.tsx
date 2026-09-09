"use client";

// Служебные оверлеи поверх игрового экрана: пауза, восстановление связи
// и тост о передаче комнаты. Порт из mafia-design/mafia/screen-service.

import { useEffect, useState } from "react";
import { Pause, RefreshCw, Crown, LogOut, X, DoorClosed } from "lucide-react";

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: 28,
        textAlign: "center",
        background: "rgba(5,5,9,0.82)",
        backdropFilter: "blur(6px)",
        color: "var(--mf-text)",
      }}
    >
      {children}
    </div>
  );
}

function Circle({ children, spin = false }: { children: React.ReactNode; spin?: boolean }) {
  return (
    <div
      style={{
        width: 88,
        height: 88,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.14)",
        animation: spin ? "mfPulse 1.6s ease-in-out infinite" : undefined,
      }}
    >
      {children}
    </div>
  );
}

/** Игра на паузе. Снять может только хост. */
export function PauseOverlay({
  isHost,
  onResume,
  onEndGame,
}: {
  isHost: boolean;
  onResume: () => void;
  /** Оборвать партию и вернуть всех в лобби. Только у хоста. */
  onEndGame: () => void;
}) {
  return (
    <Backdrop>
      <Circle>
        <Pause size={40} strokeWidth={1.6} />
      </Circle>
      <div style={{ fontWeight: 800, fontSize: 30, letterSpacing: "-0.02em" }}>Игра на паузе</div>
      {isHost ? (
        <>
          <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--mf-text-dim)", lineHeight: 1.5 }}>
            Таймеры остановлены.
            <br />
            Игроки ждут тебя.
          </div>
          <button type="button" className="mf-btn mf-btn-crimson" style={{ minWidth: 220, marginTop: 8 }} onClick={onResume}>
            Продолжить игру
          </button>
          {/* Единственный способ разойтись, если партию доигрывать уже не с
              кем: комната остаётся, состав пересобирается в лобби. */}
          <button type="button" className="mf-btn mf-btn-ghost" style={{ minWidth: 220 }} onClick={onEndGame}>
            Завершить партию
          </button>
        </>
      ) : (
        <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--mf-text-dim)", lineHeight: 1.5 }}>
          Хост остановил таймеры.
          <br />
          Никуда не уходи.
        </div>
      )}
    </Backdrop>
  );
}

/** Связь оборвалась — socket.io переподключается сам. */
export function ReconnectOverlay() {
  return (
    <Backdrop>
      <Circle spin>
        <RefreshCw size={38} strokeWidth={1.6} color="var(--mf-crimson)" />
      </Circle>
      <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: "-0.02em" }}>Возвращаемся в игру…</div>
      <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--mf-text-dim)", lineHeight: 1.5 }}>
        Соединение прервалось.
        <br />
        Твоя роль и голос сохранены.
      </div>
      <style>{`@keyframes mfPulse { 0%,100% { opacity: .55 } 50% { opacity: 1 } }`}</style>
    </Backdrop>
  );
}

/**
 * Соединение закрыто сервером: комнаты больше нет, хост выгнал или истёк
 * токен. Без этого экрана игрок остался бы смотреть на замерший интерфейс
 * и не понял бы, что игра для него закончилась.
 */
export function ClosedOverlay({ reason, onHome }: { reason: string | null; onHome: () => void }) {
  return (
    <Backdrop>
      <Circle>
        <DoorClosed size={38} strokeWidth={1.6} color="var(--mf-crimson)" />
      </Circle>
      <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: "-0.02em" }}>Игра прервана</div>
      <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--mf-text-dim)", lineHeight: 1.5 }}>
        {reason ?? "Соединение с комнатой закрыто"}
      </div>
      <button type="button" className="mf-btn mf-btn-surface" style={{ minWidth: 220, marginTop: 8 }} onClick={onHome}>
        На главную
      </button>
    </Backdrop>
  );
}

/**
 * Тост «теперь ведёшь комнату ты». Показывается, когда хост сменился на нас:
  * на сервере передача происходит молча, и без этого игрок не понял бы,
 * откуда у него взялись кнопки управления.
 */
export function HostToast({ show, onClose }: { show: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!show) return;
    const id = setTimeout(onClose, 6000);
    return () => clearTimeout(id);
  }, [show, onClose]);

  if (!show) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        top: 14,
        maxWidth: 520,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--mf-surface-2)",
        border: "1px solid var(--mf-gold)",
        borderRadius: 16,
        padding: "13px 16px",
        boxShadow: "0 10px 36px rgba(0,0,0,0.6), var(--sh-glow-gold)",
        color: "var(--mf-text)",
        zIndex: 90,
      }}
    >
      <Crown size={21} color="var(--mf-gold)" />
      <div style={{ flex: 1, textAlign: "left" }}>
        <div style={{ fontWeight: 800, fontSize: 14.5 }}>Теперь ты ведёшь комнату</div>
        <div style={{ fontWeight: 600, fontSize: 12.5, color: "var(--mf-text-dim)", marginTop: 1 }}>
          Прежний хост вышел из игры
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mf-text-faint)", display: "flex" }}
      >
        <X size={17} />
      </button>
    </div>
  );
}

/** Замечает момент, когда хостом стали мы, и один раз показывает тост. */
export function useHostToast(isHost: boolean): { show: boolean; close: () => void } {
  const [show, setShow] = useState(false);
  const [wasHost, setWasHost] = useState(isHost);

  // Сравнение с предыдущим значением делается прямо в рендере — так React
  // советует выводить состояние из пропсов. Через эффект получался лишний
  // проход рендера, и тост мигал на кадр позже смены хоста.
  if (isHost !== wasHost) {
    setWasHost(isHost);
    if (isHost) setShow(true);
  }

  return { show, close: () => setShow(false) };
}

/**
 * Кто-то вышел из партии сам. Обрыв связи сюда не относится: там человек
 * просто гаснет в списке и, скорее всего, вернётся. Здесь — окончательный
 * уход по кнопке, и остальным важно понимать, почему стол поредел.
 */
export function LeftToast({
  name,
  inLobby,
  onClose,
}: {
  name: string | null;
  inLobby: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!name) return;
    const id = setTimeout(onClose, 5000);
    return () => clearTimeout(id);
  }, [name, onClose]);

  if (!name) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        top: 14,
        maxWidth: 520,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--mf-surface-2)",
        border: "1px solid var(--mf-border)",
        borderRadius: 16,
        padding: "13px 16px",
        boxShadow: "0 10px 36px rgba(0,0,0,0.6)",
        color: "var(--mf-text)",
        zIndex: 90,
      }}
    >
      <LogOut size={21} color="var(--mf-text-dim)" />
      <div style={{ flex: 1, textAlign: "left" }}>
        <div style={{ fontWeight: 800, fontSize: 14.5 }}>{name} вышел из игры</div>
        <div style={{ fontWeight: 600, fontSize: 12.5, color: "var(--mf-text-dim)", marginTop: 1 }}>
          {inLobby ? "Освободилось место в комнате" : "Партия продолжается без него"}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mf-text-faint)", display: "flex" }}
      >
        <X size={17} />
      </button>
    </div>
  );
}

/**
 * Замечает, что участник ушёл насовсем. Уход выглядит по-разному: в лобби
 * человека вычёркивают из списка, а в идущей партии оставляют, пометив
 * `eliminatedBy: "left"`, — иначе вместе с ним пропала бы его роль.
 *
 * Первый расчёт только запоминает текущее состояние: подсевший к идущей
 * партии не должен получить пачку уведомлений о тех, кто ушёл до него.
 */
export function useLeftToast(
  players: readonly { userId: string; displayName: string; eliminatedBy?: string }[],
): { name: string | null; inLobby: boolean; close: () => void } {
  const [seen, setSeen] = useState<Set<string> | null>(null);
  const [notice, setNotice] = useState<{ name: string; inLobby: boolean } | null>(null);

  const goneNow = new Set(
    players.filter((p) => p.eliminatedBy === "left").map((p) => p.userId),
  );
  const ids = players.map((p) => p.userId).join(",");
  const [prevIds, setPrevIds] = useState(ids);
  const [prevNames, setPrevNames] = useState(() =>
    new Map(players.map((p) => [p.userId, p.displayName])),
  );

  // Сравнение с прошлым состоянием прямо в рендере — как в useHostToast.
  if (seen === null) {
    setSeen(goneNow);
  } else if (ids !== prevIds) {
    const now = new Set(players.map((p) => p.userId));
    const vanished = [...prevNames.keys()].find((id) => !now.has(id));
    if (vanished) setNotice({ name: prevNames.get(vanished) ?? "Игрок", inLobby: true });
    setPrevIds(ids);
    setPrevNames(new Map(players.map((p) => [p.userId, p.displayName])));
  } else {
    const fresh = players.find(
      (p) => p.eliminatedBy === "left" && !seen.has(p.userId),
    );
    if (fresh) {
      setSeen(goneNow);
      setNotice({ name: fresh.displayName, inLobby: false });
    }
  }

  return {
    name: notice?.name ?? null,
    inLobby: notice?.inLobby ?? false,
    close: () => setNotice(null),
  };
}
