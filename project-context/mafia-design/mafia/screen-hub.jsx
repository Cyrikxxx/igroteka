// Хаб платформы — мобильный (390×844) и десктопный (1180×740)
function GameCard({ accent, accentHover, title, tagline, badges, meta, dark, filler }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div style={{
      background: 'var(--ink-surface)',
      border: '1.5px solid var(--ink-border)',
      borderRadius: 'var(--r-card)',
      padding: '24px 22px 22px',
      display: 'flex', flexDirection: 'column', gap: 12,
      position: 'relative', overflow: 'hidden', flex: 1,
    }}>
      <div style={{
        position: 'absolute', top: -60, right: -60, width: 200, height: 200,
        borderRadius: '50%', background: accent, opacity: 0.12, filter: 'blur(40px)',
        pointerEvents: 'none',
      }}></div>
      <div style={{ display: 'flex', gap: 8 }}>
        {badges.map(b => (
          <span key={b} className="mf-chip" style={{ background: 'rgba(255,255,255,0.06)' }}>{b}</span>
        ))}
      </div>
      <div style={{ fontWeight: 800, fontSize: 'clamp(30px, 4vw, 38px)', letterSpacing: '-0.02em', color: accent, lineHeight: 1 }}>{title}</div>
      <div style={{ color: 'var(--mf-text-dim)', fontSize: 15.5, fontWeight: 600, lineHeight: 1.45, textWrap: 'pretty', minHeight: 44 }}>{tagline}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--mf-text-faint)', fontSize: 13.5, fontWeight: 700 }}>
        <LIcon name="Users" size={16} />{meta}
      </div>
      {filler ? <div style={{ marginTop: 'auto', paddingTop: 14 }}>{filler}</div> : null}
      <button className="mf-btn" type="button"
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ background: hover ? accentHover : accent, color: dark ? '#06130a' : '#fff', marginTop: filler ? 6 : 'auto' }}>
        Играть
        <LIcon name="ArrowRight" size={19} />
      </button>
    </div>
  );
}

function CodeEntry({ wide }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: wide ? 'center' : 'stretch' }}>
      <div style={{ color: 'var(--mf-text-faint)', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: wide ? 'center' : 'left' }}>Есть код комнаты?</div>
      <div style={{ display: 'flex', gap: 10, width: wide ? 420 : '100%' }}>
        <div className="mf-mono" style={{
          flex: 1, background: 'var(--ink-surface)', border: '1.5px solid var(--ink-border)',
          borderRadius: 'var(--r-btn)', padding: '14px 18px', fontSize: 20, fontWeight: 700,
          letterSpacing: '0.35em', color: 'var(--mf-text-faint)', display: 'flex', alignItems: 'center',
        }}>K7F2QD</div>
        <button className="mf-btn mf-btn-surface" type="button" style={{ minWidth: 100 }}>Войти</button>
      </div>
    </div>
  );
}

function HubFooter() {
  return (
    <div style={{ display: 'flex', gap: 22, justifyContent: 'center', color: 'var(--mf-text-faint)', fontSize: 13.5, fontWeight: 700, padding: '16px 0 4px' }}>
      <span style={{ cursor: 'pointer' }}>О нас</span>
      <span style={{ cursor: 'pointer' }}>Правила</span>
      <span style={{ cursor: 'pointer' }}>История</span>
    </div>
  );
}

const aliasCard = {
  accent: 'var(--alias-green)', accentHover: 'var(--alias-green-hover)', dark: true,
  title: 'Алиас', tagline: 'Объясняй слова на время',
  badges: ['Онлайн', 'Локально'], meta: '2–6 команд',
};
const mafiaCard = {
  accent: 'var(--mf-crimson)', accentHover: 'var(--mf-crimson-hover)',
  title: 'Мафия', tagline: 'Найди мафию раньше, чем она найдёт тебя',
  badges: ['Онлайн'], meta: '5–16 игроков',
};

function HubMobile() {
  return (
    <div className="mf-screen" style={{ background: 'var(--ink-bg)', padding: '20px 20px 14px', gap: 18 }} data-screen-label="Хаб — мобильный">
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--alias-green)' }}></div>
        <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--mf-crimson)' }}></div>
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.04em' }}>ИГРОТЕКА</span>
      </div>
      <h1 style={{ margin: '12px 0 2px', fontWeight: 800, fontSize: 33, letterSpacing: '-0.025em', lineHeight: 1.12, textWrap: 'pretty' }}>Во что играем сегодня?</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <GameCard {...aliasCard} />
        <GameCard {...mafiaCard} />
      </div>
      <CodeEntry />
      <HubFooter />
    </div>
  );
}

// Наполнение нижней части карточек на десктопе
function AliasFiller() {
  const words = ['жираф', 'космос', 'сквозняк', 'оркестр', 'карамель', 'пельмень', 'маяк'];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {words.map((w, i) => (
        <span key={w} className="mf-chip" style={{
          background: 'rgba(34,197,94,0.09)',
          color: i % 3 === 0 ? 'var(--alias-green)' : 'var(--mf-text-dim)',
          fontSize: 13, padding: '6px 13px',
        }}>{w}</span>
      ))}
    </div>
  );
}

function MafiaFiller() {
  const order = ['mafia', 'don', 'sheriff', 'doctor', 'maniac', 'civilian'];
  return (
    <div style={{ display: 'flex', gap: 9 }}>
      {order.map(k => {
        const r = ROLES[k];
        return (
          <div key={k} title={r.label} style={{
            width: 42, height: 42, borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.04)',
            border: `1.5px solid ${k === 'don' ? 'var(--mf-gold)' : r.color}`,
            color: r.color,
          }}>
            <LIcon name={r.icon} size={20} strokeWidth={1.8} />
          </div>
        );
      })}
    </div>
  );
}

function HubDesktop() {
  return (
    <div className="mf-screen" style={{ background: 'var(--ink-bg)', padding: '28px 64px 20px', gap: 26 }} data-screen-label="Хаб — десктоп">
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--alias-green)' }}></div>
        <div style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--mf-crimson)' }}></div>
        <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.04em' }}>ИГРОТЕКА</span>
      </div>
      <h1 style={{ margin: '18px 0 0', fontWeight: 800, fontSize: 52, letterSpacing: '-0.03em', textAlign: 'center', lineHeight: 1.05 }}>Во что играем сегодня?</h1>
      <div style={{ display: 'flex', gap: 22, maxWidth: 880, width: '100%', margin: '0 auto', flex: 1, alignItems: 'stretch' }}>
        <GameCard {...aliasCard} filler={<AliasFiller />} />
        <GameCard {...mafiaCard} filler={<MafiaFiller />} />
      </div>
      <CodeEntry wide={true} />
      <HubFooter />
    </div>
  );
}

Object.assign(window, { HubMobile, HubDesktop });
