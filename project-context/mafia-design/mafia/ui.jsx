// UI-примитивы зоны Мафии: обёртка десктопа, тоглы, степперы, пресеты, ячейки игроков
function GameScreen({ desktop, vignette, label, col = 620, children, style }) {
  const cls = 'mf-screen' + (vignette ? ' mf-vignette' : '');
  if (!desktop) {
    return <div className={cls} data-screen-label={label} style={style}>{children}</div>;
  }
  return (
    <div className={cls} data-screen-label={label} style={style}>
      <div style={{ width: col, maxWidth: '92%', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}

function MfSwitch({ on, accent = 'var(--mf-crimson)' }) {
  return (
    <div style={{
      width: 46, height: 27, borderRadius: 999, flexShrink: 0, cursor: 'pointer',
      background: on ? accent : 'var(--mf-surface-2)',
      border: '1px solid ' + (on ? 'transparent' : 'var(--mf-border)'),
      position: 'relative', transition: 'background 0.15s',
    }}>
      <div style={{
        position: 'absolute', top: 3, left: on ? 22 : 3, width: 19, height: 19,
        borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }}></div>
    </div>
  );
}

function ToggleRow({ label, sub, on, onChange, icon, iconColor, accent }) {
  return (
    <div className="mf-setting-row" onClick={onChange ? () => onChange(!on) : undefined} style={{ cursor: onChange ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
        {icon ? <LIcon name={icon} size={19} color={iconColor || 'var(--mf-text-dim)'} /> : null}
        <div>
          <div className="mf-setting-label">{label}</div>
          {sub ? <div className="mf-setting-sub">{sub}</div> : null}
        </div>
      </div>
      <MfSwitch on={on} accent={accent} />
    </div>
  );
}

function Stepper({ value, onChange, min = 1, max = 5 }) {
  const btn = {
    width: 34, height: 34, borderRadius: 10, border: '1px solid var(--mf-border)',
    background: 'var(--mf-surface-2)', color: 'var(--mf-text)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button type="button" style={btn} onClick={() => onChange && onChange(Math.max(min, value - 1))}><LIcon name="Minus" size={16} /></button>
      <span className="mf-mono" style={{ fontSize: 18, fontWeight: 700, minWidth: 22, textAlign: 'center' }}>{value}</span>
      <button type="button" style={btn} onClick={() => onChange && onChange(Math.min(max, value + 1))}><LIcon name="Plus" size={16} /></button>
    </div>
  );
}

function PresetChips({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button key={o} type="button" className={'mf-preset' + (o === value ? ' on' : '')}
          onClick={() => onChange && onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

// Баннер живого предпросмотра состава
function CompBanner({ children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(225,29,72,0.07)',
      border: '1px solid rgba(225,29,72,0.25)', borderRadius: 14, padding: '11px 14px',
      fontSize: 13.5, fontWeight: 700, color: 'var(--mf-text-dim)', lineHeight: 1.4,
    }}>
      <LIcon name="VenetianMask" size={18} color="var(--mf-crimson)" />
      <span>{children}</span>
    </div>
  );
}

// Универсальная ячейка игрока для ночных выборов
function PlayerCell({ p, me, picked, accent = 'var(--mf-crimson)', disabled, note, noteColor, tag, tagBg, onClick, roleChip }) {
  const pickedStyle = picked ? {
    borderColor: accent,
    boxShadow: `0 0 32px color-mix(in srgb, ${accent} 35%, transparent)`,
    background: `color-mix(in srgb, ${accent} 8%, transparent)`,
  } : undefined;
  return (
    <div className={'mf-player-card' + (disabled ? ' disabled' : '')}
      onClick={!disabled && onClick ? onClick : undefined} style={pickedStyle}>
      <Avatar name={p.name} idx={p.idx} size={42} dead={p.dead} />
      <div className="mf-player-name">{p.name}{me ? ' (ты)' : ''}</div>
      {roleChip ? roleChip : null}
      {note ? (
        <div style={{ fontSize: 11, fontWeight: 700, color: noteColor || 'var(--mf-text-faint)', textAlign: 'center', lineHeight: 1.3 }}>{note}</div>
      ) : null}
      {tag ? (
        <div className="mf-chip" style={{
          position: 'absolute', top: -9, right: 10, background: tagBg || accent,
          color: '#fff', fontSize: 11, padding: '3px 9px',
        }}>{tag}</div>
      ) : null}
    </div>
  );
}

// Нижний статус-бар («Ход принят…»)
function StatusBar({ icon, iconColor, children }) {
  return (
    <div style={{ padding: '14px 20px 18px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        background: 'var(--mf-surface)', border: '1px solid var(--mf-border)',
        borderRadius: 14, padding: '13px 16px', fontSize: 14, fontWeight: 700,
        color: 'var(--mf-text-dim)',
      }}>
        {icon ? <LIcon name={icon} size={17} color={iconColor} /> : null}
        {children}
      </div>
    </div>
  );
}

// Чип роли (имя + иконка в цвете роли)
function RoleChip({ role, size = 13 }) {
  const r = ROLES[role];
  const isDon = role === 'don';
  return (
    <span className="mf-chip" style={{
      background: `color-mix(in srgb, ${r.color} 14%, transparent)`,
      color: r.color, fontSize: 11.5, padding: '3px 10px',
      border: isDon ? '1px solid var(--mf-gold)' : '1px solid transparent',
    }}>
      <LIcon name={r.icon} size={size} />{r.label}
    </span>
  );
}

// Десктопная обёртка игрового экрана: центрированная колонна, атмосферный фон по краям
function DesktopWrap({ vignette = true, label, col = 620, children }) {
  return (
    <div className={'mf-screen' + (vignette ? ' mf-vignette' : '')} data-screen-label={label} style={{ alignItems: 'center' }}>
      <div className="mf-desktop-col" style={{
        width: col, height: '100%', display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.012)',
      }}>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, { GameScreen, MfSwitch, ToggleRow, Stepper, PresetChips, CompBanner, PlayerCell, StatusBar, RoleChip, DesktopWrap });
