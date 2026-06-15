// Сервисные состояния: пауза, реконнект, тост передачи хоста
function PauseOverlay({ host = true }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }} data-screen-label={host ? 'Игра на паузе — хост' : 'Игра на паузе — игрок'}>
      <div style={{ position: 'absolute', inset: 0, filter: 'brightness(0.35) blur(2px)', pointerEvents: 'none' }}>
        <Discussion host={false} />
      </div>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 18, padding: 28,
        fontFamily: 'var(--font-main)', color: 'var(--mf-text)', textAlign: 'center',
      }}>
        <div style={{
          width: 88, height: 88, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
          color: 'var(--mf-text)', backdropFilter: 'blur(8px)',
        }}>
          <LIcon name="Pause" size={40} strokeWidth={1.6} />
        </div>
        <div style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em' }}>Игра на паузе</div>
        {host ? (
          <React.Fragment>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--mf-text-dim)' }}>Таймеры остановлены.<br />Игроки ждут тебя.</div>
            <button className="mf-btn mf-btn-crimson" type="button" style={{ minWidth: 220, marginTop: 8 }}>Продолжить игру</button>
          </React.Fragment>
        ) : (
          <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--mf-text-dim)' }}>Хост остановил таймеры.<br />Никуда не уходи.</div>
        )}
      </div>
    </div>
  );
}

function Reconnect() {
  return (
    <div className="mf-screen mf-vignette" data-screen-label="Реконнект" style={{ '--vignette': 0.08 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 32px', textAlign: 'center' }}>
        <div style={{
          width: 88, height: 88, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--mf-border)', color: 'var(--mf-crimson)',
          animation: 'mfSpinPulse 1.6s ease-in-out infinite',
        }}>
          <LIcon name="RefreshCw" size={38} strokeWidth={1.6} />
        </div>
        <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em' }}>Возвращаемся в игру…</div>
        <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--mf-text-dim)', lineHeight: 1.5 }}>Соединение прервалось.<br />Твоя роль и голос сохранены.</div>
      </div>
      <StatusBar icon="Wifi">проверь соединение, если это надолго</StatusBar>
      <style>{`@keyframes mfSpinPulse { 0%,100% { opacity: 0.6 } 50% { opacity: 1 } }`}</style>
    </div>
  );
}

function HostToast() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }} data-screen-label="Тост — передача хоста">
      <Discussion host={true} />
      <div style={{
        position: 'absolute', left: 16, right: 16, top: 14,
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--mf-surface-2)', border: '1px solid var(--mf-gold)',
        borderRadius: 16, padding: '13px 16px',
        boxShadow: '0 10px 36px rgba(0,0,0,0.6), var(--sh-glow-gold)',
        fontFamily: 'var(--font-main)', color: 'var(--mf-text)', zIndex: 5,
      }}>
        <LIcon name="Crown" size={21} color="var(--mf-gold)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14.5 }}>Теперь ты ведёшь комнату</div>
          <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--mf-text-dim)', marginTop: 1 }}>Прежний хост вышел из игры</div>
        </div>
        <LIcon name="X" size={17} color="var(--mf-text-faint)" />
      </div>
    </div>
  );
}

Object.assign(window, { PauseOverlay, Reconnect, HostToast });
