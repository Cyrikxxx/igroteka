// Мини-таблица токенов зоны Мафии (для переноса в Tailwind)
function TokenSwatch({ name, value, label, border }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: value,
        border: border || '1px solid rgba(255,255,255,0.12)', flexShrink: 0,
      }}></div>
      <div style={{ minWidth: 0 }}>
        <div className="mf-mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mf-text)' }}>{name}</div>
        <div className="mf-mono" style={{ fontSize: 11.5, color: 'var(--mf-text-faint)' }}>{value}{label ? ` · ${label}` : ''}</div>
      </div>
    </div>
  );
}

function TokenGroup({ title, children, span }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, gridColumn: span ? 'span 2' : undefined }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--mf-text-faint)' }}>{title}</div>
      {children}
    </div>
  );
}

function TokensBoard() {
  return (
    <div className="mf-screen" style={{ padding: 32, overflow: 'visible' }} data-screen-label="Токены Мафии">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '28px 32px' }}>
        <TokenGroup title="Акценты">
          <TokenSwatch name="mafia-crimson" value="#e11d48" label="акцент" />
          <TokenSwatch name="mafia-crimson-hover" value="#f43f5e" label="hover" />
          <TokenSwatch name="mafia-gold" value="#f59e0b" label="Дон · Шериф · драма" />
        </TokenGroup>
        <TokenGroup title="Фоны">
          <TokenSwatch name="mafia-bg" value="#0a0a0f" label="партия" />
          <TokenSwatch name="mafia-surface" value="#14141d" label="карточки" />
          <TokenSwatch name="mafia-surface-2" value="#1b1b27" label="кнопки/чипы" />
        </TokenGroup>
        <TokenGroup title="Роли">
          <TokenSwatch name="role-mafia" value="#e11d48" />
          <TokenSwatch name="role-don" value="#e11d48" label="+ окантовка #f59e0b" border="2px solid #f59e0b" />
          <TokenSwatch name="role-sheriff" value="#f59e0b" />
        </TokenGroup>
        <TokenGroup title=" ">
          <TokenSwatch name="role-doctor" value="#38bdf8" />
          <TokenSwatch name="role-maniac" value="#a855f7" />
          <TokenSwatch name="role-civilian" value="#94a3b8" />
        </TokenGroup>

        <TokenGroup title="Типографика" span>
          <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em' }}>Manrope 800 — заголовки фаз</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Manrope 700 — кнопки, имена, бейджи</div>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--mf-text-dim)' }}>Manrope 600 — вторичный текст</div>
          <div className="mf-mono" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.2em' }}>K7F2QD · 0:42</div>
          <div className="mf-mono" style={{ fontSize: 12, color: 'var(--mf-text-faint)' }}>JetBrains Mono 700 — коды, таймеры, счётчики</div>
        </TokenGroup>

        <TokenGroup title="Радиусы">
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            {[['r-card', 20], ['r-btn', 14], ['r-chip', 999]].map(([n, v]) => (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 64, height: 64, borderRadius: v, background: 'var(--mf-surface-2)', border: '1px solid var(--mf-border)' }}></div>
                <div className="mf-mono" style={{ fontSize: 11.5, color: 'var(--mf-text-faint)' }}>{n} · {v === 999 ? 'full' : v + 'px'}</div>
              </div>
            ))}
          </div>
        </TokenGroup>

        <TokenGroup title="Тени и свечение">
          <div style={{ display: 'flex', gap: 14 }}>
            {[['sh-card', 'var(--sh-card)'], ['glow-crimson', 'var(--sh-glow-crimson)'], ['glow-gold', 'var(--sh-glow-gold)']].map(([n, v]) => (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 64, height: 64, borderRadius: 14, background: 'var(--mf-surface)', border: '1px solid var(--mf-border)', boxShadow: v }}></div>
                <div className="mf-mono" style={{ fontSize: 11.5, color: 'var(--mf-text-faint)' }}>{n}</div>
              </div>
            ))}
          </div>
        </TokenGroup>
      </div>
    </div>
  );
}

Object.assign(window, { TokensBoard });
