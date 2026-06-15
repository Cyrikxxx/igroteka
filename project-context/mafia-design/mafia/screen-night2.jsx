// Ночные экраны остальных ролей: мирный, доктор, шериф (выбор + вердикт), маньяк
function NightCivilian() {
  return (
    <div className="mf-screen mf-vignette" data-screen-label="Ночь — мирный">
      <PhaseHead icon="Moon" title="Ночь 2" timer="0:42" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '0 32px', textAlign: 'center' }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--mf-border)', color: 'var(--mf-text-dim)',
        }}>
          <LIcon name="MoonStar" size={44} strokeWidth={1.4} />
        </div>
        <div style={{ fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em' }}>Город спит</div>
        <div style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--mf-text-dim)', lineHeight: 1.5 }}>Не подглядывай.<br />Утром узнаешь, что случилось.</div>
      </div>
      <StatusBar icon="VenetianMask" iconColor="var(--mf-crimson)">мафия совещается…</StatusBar>
    </div>
  );
}

function NightDoctor() {
  const [pick, setPick] = React.useState(null);
  const alive = PLAYERS.slice(0, 8);
  const prevTarget = 3; // Маша — лечил прошлой ночью
  return (
    <div className="mf-screen mf-vignette" data-screen-label="Ночь — доктор">
      <PhaseHead icon="HeartPulse" title="Ночь 2" timer="0:42" />
      <div style={{ padding: '6px 20px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--mf-text-dim)' }}>Кого будешь лечить этой ночью?</div>
        <div className="mf-chip" style={{ alignSelf: 'flex-start', background: 'rgba(56,189,248,0.12)', color: 'var(--role-doctor)' }}>
          <LIcon name="HeartPulse" size={14} />Самолечение: осталось 1
        </div>
      </div>
      <div className="mf-player-grid" style={{ flex: 1, alignContent: 'start' }}>
        {alive.map((p, i) => (
          <PlayerCell key={p.name} p={p} me={p.name === 'Кира'}
            accent="var(--role-doctor)"
            picked={pick === i}
            disabled={i === prevTarget}
            note={i === prevTarget ? 'лечил прошлой ночью' : null}
            tag={pick === i ? 'лечишь' : null}
            onClick={() => setPick(pick === i ? null : i)} />
        ))}
      </div>
      <StatusBar icon={pick != null ? 'Check' : 'MousePointerClick'} iconColor={pick != null ? 'var(--role-doctor)' : undefined}>
        {pick != null ? 'Ход принят. Ждём остальных…' : 'Тапни по игроку, чтобы вылечить'}
      </StatusBar>
    </div>
  );
}

function NightSheriff() {
  const alive = PLAYERS.slice(0, 8).filter(p => p.name !== 'Оля'); // шериф — Оля
  return (
    <div className="mf-screen mf-vignette" data-screen-label="Ночь — шериф" style={{ position: 'relative' }}>
      <PhaseHead icon="Search" title="Ночь 2" timer="0:42" gold />
      <div style={{ padding: '6px 20px 14px' }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--mf-text-dim)' }}>Кого проверишь этой ночью?</div>
      </div>
      <div className="mf-player-grid" style={{ flex: 1, alignContent: 'start' }}>
        {alive.map((p, i) => (
          <PlayerCell key={p.name} p={p} accent="var(--mf-gold)" picked={p.name === 'Лена'} tag={p.name === 'Лена' ? 'проверка' : null} tagBg="var(--mf-gold)" />
        ))}
      </div>
      <StatusBar icon="MousePointerClick">Тапни по игроку, чтобы проверить</StatusBar>
      {/* Подтверждение */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,9,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28, zIndex: 3 }}>
        <div style={{
          width: '100%', background: 'var(--mf-surface)', border: '1px solid var(--mf-border)',
          borderRadius: 'var(--r-card)', padding: '24px 20px 18px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          boxShadow: 'var(--sh-glow-gold)',
        }}>
          <Avatar name="Лена" idx={5} size={56} />
          <div style={{ fontWeight: 800, fontSize: 22 }}>Проверить Лену?</div>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--mf-text-faint)', textAlign: 'center' }}>Результат проверки увидишь только ты</div>
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button className="mf-btn mf-btn-ghost" type="button" style={{ flex: 1 }}>Отмена</button>
            <button className="mf-btn" type="button" style={{ flex: 1, background: 'var(--mf-gold)', color: '#1a1102' }}>Проверить</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SheriffVerdict({ mafia }) {
  const name = mafia ? 'Лена' : 'Артём';
  return (
    <div className="mf-screen mf-vignette" data-screen-label={'Вердикт шерифа — ' + (mafia ? 'мафия' : 'не мафия')}
      style={mafia ? { '--vignette': 0.3 } : null}>
      <PhaseHead icon="Search" title="Ночь 2" gold />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 28px', textAlign: 'center' }}>
        <div style={{
          width: 104, height: 104, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: mafia ? 'rgba(225,29,72,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1.5px solid ${mafia ? 'var(--mf-crimson)' : 'var(--mf-border)'}`,
          color: mafia ? 'var(--mf-crimson)' : 'var(--mf-text-dim)',
          boxShadow: mafia ? 'var(--sh-glow-crimson)' : 'none',
        }}>
          <LIcon name={mafia ? 'VenetianMask' : 'UserCheck'} size={48} strokeWidth={1.5} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 24, color: 'var(--mf-text-dim)' }}>{name} —</div>
          <div style={{
            fontWeight: 800, fontSize: mafia ? 52 : 38, letterSpacing: mafia ? '0.02em' : '-0.01em', lineHeight: 1.1,
            color: mafia ? 'var(--mf-crimson)' : 'var(--mf-text)',
            textShadow: mafia ? '0 0 44px rgba(225,29,72,0.5)' : 'none',
          }}>{mafia ? 'МАФИЯ' : 'не мафия'}</div>
        </div>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--mf-text-faint)' }}>Это видишь только ты. Используй днём.</div>
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <button className="mf-btn mf-btn-surface" type="button" style={{ width: '100%' }}>Понятно</button>
      </div>
    </div>
  );
}

function NightManiac() {
  const [pick, setPick] = React.useState(6);
  const alive = PLAYERS.slice(0, 8);
  return (
    <div className="mf-screen mf-vignette" data-screen-label="Ночь — маньяк" style={{ '--vignette': 0.1 }}>
      <PhaseHead icon="Skull" title="Ночь 2" timer="0:42" />
      <div style={{ padding: '6px 20px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--mf-text-dim)' }}>Выбери жертву этой ночи</div>
        <div className="mf-chip" style={{ alignSelf: 'flex-start', background: 'rgba(168,85,247,0.13)', color: 'var(--role-maniac)' }}>
          <LIcon name="Skull" size={14} />Ты играешь сам за себя
        </div>
      </div>
      <div className="mf-player-grid" style={{ flex: 1, alignContent: 'start' }}>
        {alive.map((p, i) => (
          <PlayerCell key={p.name} p={p} me={p.name === 'Лена'}
            accent="var(--role-maniac)"
            disabled={p.name === 'Лена'}
            picked={pick === i}
            tag={pick === i ? 'жертва' : null}
            onClick={() => setPick(pick === i ? null : i)} />
        ))}
      </div>
      <StatusBar icon={pick != null ? 'Check' : 'MousePointerClick'} iconColor={pick != null ? 'var(--role-maniac)' : undefined}>
        {pick != null ? 'Ход принят. Ждём остальных…' : 'Тапни по игроку'}
      </StatusBar>
    </div>
  );
}

Object.assign(window, { NightCivilian, NightDoctor, NightSheriff, SheriffVerdict, NightManiac });
