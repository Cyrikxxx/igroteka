// Общий каркас страниц платформы: шапка, заголовок страницы, подвал.
function PlatformTopBar({ desktop, active }) {
  const nav = ['О нас', 'Правила', 'История', 'Поддержка'];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: desktop ? '20px 56px' : '16px 20px', borderBottom: '1px solid var(--ink-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--al-green)' }}></div>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--mf-crimson)' }}></div>
        </div>
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.04em' }}>ИГРОТЕКА</span>
      </div>
      {desktop ? (
        <div style={{ display: 'flex', gap: 26, fontSize: 14.5, fontWeight: 700, color: 'var(--mf-text-dim)' }}>
          {nav.map(n => <span key={n} style={{ color: n === active ? 'var(--mf-text)' : undefined }}>{n}</span>)}
        </div>
      ) : null}
      <div style={{
        width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--ink-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mf-text-dim)',
      }}>
        <LIcon name="Moon" size={16} />
      </div>
    </div>
  );
}

function PageHead({ desktop, title, lead }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--mf-text-dim)' }}>
        <LIcon name="ArrowLeft" size={16} />На главную
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1 style={{ margin: 0, fontWeight: 800, fontSize: desktop ? 58 : 38, letterSpacing: '-0.03em', lineHeight: 1 }}>{title}</h1>
        <p style={{ margin: 0, fontSize: desktop ? 17 : 15, fontWeight: 600, color: 'var(--mf-text-dim)', maxWidth: 660, lineHeight: 1.5, textWrap: 'pretty' }}>{lead}</p>
      </div>
    </div>
  );
}

function SectionTitle({ desktop, children, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
      <h2 style={{ margin: 0, fontWeight: 800, fontSize: desktop ? 28 : 22, letterSpacing: '-0.02em' }}>{children}</h2>
      {note ? <span className="mf-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--mf-text-faint)' }}>{note}</span> : null}
    </div>
  );
}

function InkCard({ children, style }) {
  return (
    <div style={{
      background: 'var(--ink-surface)', border: '1px solid var(--ink-border)',
      borderRadius: 'var(--r-card)', padding: '20px 20px 18px',
      display: 'flex', flexDirection: 'column', gap: 10, ...style,
    }}>{children}</div>
  );
}

function PageFooter({ desktop }) {
  return (
    <div style={{
      borderTop: '1px solid var(--ink-border)', marginTop: 12, paddingTop: 20,
      display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between',
      flexDirection: desktop ? 'row' : 'column', color: 'var(--mf-text-faint)', fontSize: 13, fontWeight: 700,
    }}>
      <span>Игротека · Алиас и Мафия</span>
      <div style={{ display: 'flex', gap: 18 }}>
        <span>О нас</span><span>Правила</span><span>История</span><span>Поддержка</span>
      </div>
    </div>
  );
}

function PageShell({ desktop, active, children }) {
  return (
    <div className="mf-screen" data-screen-label={active} style={{
      background: 'var(--ink-bg)', overflow: 'visible', height: 'auto', minHeight: '100%',
    }}>
      <PlatformTopBar desktop={desktop} active={active} />
      <div style={{
        padding: desktop ? '34px 56px 40px' : '24px 20px 32px',
        display: 'flex', flexDirection: 'column', gap: desktop ? 40 : 30,
      }}>{children}</div>
    </div>
  );
}

Object.assign(window, { PlatformTopBar, PageHead, SectionTitle, InkCard, PageFooter, PageShell });
