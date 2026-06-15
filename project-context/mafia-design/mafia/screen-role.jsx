// Выдача роли — карта «прижми и держи» (390×844)
// Интерактив: палец/мышь на карте — лицо, отпустил — рубашка.
function RoleCardFace({ role, partners }) {
  const r = ROLES[role];
  const team = role === 'mafia' || role === 'don' ? 'Команда мафии'
    : role === 'maniac' ? 'Играет сам за себя' : 'Команда города';
  const task = {
    mafia: 'Ночью убирайте город. Днём не выдай себя.',
    don: 'Решающий голос мафии при выборе жертвы.',
    sheriff: 'Каждую ночь проверяй одного игрока.',
    doctor: 'Каждую ночь спасай одного. Себя — один раз.',
    maniac: 'Убивай по ночам. Останься последним.',
    civilian: 'Слушай, спорь, вычисляй мафию днём.',
  }[role];
  const isDon = role === 'don';
  return (
    <div style={{
      position: 'absolute', inset: 0, borderRadius: 24,
      background: 'linear-gradient(170deg, #16161f 0%, #101018 100%)',
      border: `2px solid ${isDon ? 'var(--mf-gold)' : r.color}`,
      boxShadow: `0 0 44px ${role === 'sheriff' || isDon ? 'rgba(245,158,11,0.35)' : 'rgba(225,29,72,0.30)'}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 14, padding: 24, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
    }}>
      <div style={{
        width: 92, height: 92, borderRadius: '50%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(255,255,255,0.05)',
        border: `1.5px solid ${r.color}`, color: r.color,
      }}>
        <LIcon name={r.icon} size={46} strokeWidth={1.6} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 34, letterSpacing: '0.02em', color: r.color, textTransform: 'uppercase' }}>{r.label}</div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mf-text-faint)', marginTop: 4 }}>{team}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--mf-text-dim)', textAlign: 'center', lineHeight: 1.5, textWrap: 'pretty' }}>{task}</div>
      {partners ? (
        <div style={{
          marginTop: 4, display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.3)',
          borderRadius: 999, padding: '7px 14px', fontSize: 13.5, fontWeight: 700,
        }}>
          <LIcon name="VenetianMask" size={15} color="var(--mf-crimson)" />
          <span>Напарники: {partners.join(' · ')}</span>
        </div>
      ) : null}
    </div>
  );
}

function RoleCardBack() {
  return (
    <div style={{
      position: 'absolute', inset: 0, borderRadius: 24,
      background: 'repeating-linear-gradient(135deg, #13131c 0px, #13131c 10px, #101018 10px, #101018 20px)',
      border: '2px solid rgba(225,29,72,0.4)',
      boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backfaceVisibility: 'hidden',
    }}>
      <div style={{
        width: 86, height: 86, borderRadius: '50%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', border: '1.5px solid rgba(225,29,72,0.45)',
        color: 'rgba(225,29,72,0.65)',
      }}>
        <LIcon name="VenetianMask" size={42} strokeWidth={1.5} />
      </div>
    </div>
  );
}

function RoleReveal({ role = 'mafia', partners, alwaysOpen = false, label }) {
  const [held, setHeld] = React.useState(false);
  const open = alwaysOpen || held;
  const down = () => !alwaysOpen && setHeld(true);
  const up = () => setHeld(false);
  return (
    <div className="mf-screen mf-vignette" data-screen-label={label || 'Выдача роли'}>
      <div style={{ textAlign: 'center', padding: '26px 24px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mf-text-faint)' }}>Твоя роль</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '0 24px' }}>
        <div
          onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}
          onContextMenu={e => e.preventDefault()}
          style={{ width: 270, height: 396, perspective: 1100, cursor: 'pointer', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}>
          <div style={{
            position: 'relative', width: '100%', height: '100%',
            transformStyle: 'preserve-3d', transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.25, 1)',
            transform: open ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}>
            <RoleCardBack />
            <RoleCardFace role={role} partners={partners} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--mf-text-dim)', fontSize: 14.5, fontWeight: 700, opacity: open ? 0 : 1, transition: 'opacity 0.2s' }}>
          <LIcon name="Fingerprint" size={17} />
          Прижми и держи, чтобы увидеть роль
        </div>
      </div>
      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="mf-btn mf-btn-crimson" type="button">Я запомнил</button>
        <div className="mf-mono" style={{ textAlign: 'center', fontSize: 13, color: 'var(--mf-text-faint)', fontWeight: 700 }}>Готовы 7 из 9</div>
      </div>
    </div>
  );
}

Object.assign(window, { RoleReveal });
