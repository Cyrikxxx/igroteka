"use client";

// Служебные оверлеи поверх игрового экрана: пауза, восстановление связи
// и тост о передаче комнаты. Порт из mafia-design/mafia/screen-service.

import { useEffect, useState } from "react";
import { Pause, RefreshCw, Crown, X, DoorClosed } from "lucide-react";

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
