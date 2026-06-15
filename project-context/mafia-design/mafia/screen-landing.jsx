// Лендинг Мафии — нуар-хиро, «Как игать» и сетка ролей. Мобайл + десктоп.
const LANDING_STEPS = [
  ['DoorOpen', 'Создай комнату', 'Скинь код друзьям — телефоны вместо карточек'],
  ['VenetianMask', 'Получи тайную роль', 'Прижми карту, запомни, никому не показывай'],
  ['Moon', 'Ночью роли действуют', 'Мафия выбирает, доктор лечит, шериф проверяет'],
  ['Vote', 'Днём — спор и голосование', 'Обсуждайте голосом и изгоняйте подозреваемых'],
];

const LANDING_ROLES = [
  ['mafia', 'Ночью убирает горожан'],
  ['don', 'Решающий голос мафии при ничьей'],
  ['sheriff', 'Каждую ночь проверяет одного игрока'],
  ['doctor', 'Лечит одного за ночь, себя — один раз'],
  ['maniac', 'Играет сам за себя, убивает по ночам'],
  ['civilian', 'Слушает, спорит, вычисляет мафию днём'],
];

function LandingHero({ desktop }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      gap: 16, padding: desktop ? '72px 64px 56px' : '52px 24px 40px', position: 'relative',
    }}>
      <span className="mf-chip" style={{ background: 'rgba(225,29,72,0.1)', color: 'var(--mf-crimson-hover)' }}>
        <LIcon name="Sparkles" size={14} />Новая игра в Игротеке
      </span>
      <div style={{ fontWeight: 800, fontSize: desktop ? 108 : 64, letterSpacing: '0.04em', lineHeight: 1, color: 'var(--mf-crimson)', textShadow: '0 0 60px rgba(225,29,72,0.4)' }}>МАФИЯ</div>
      <div style={{ fontWeight: 700, fontSize: desktop ? 22 : 17, color: 'var(--mf-text-dim)', maxWidth: 460, lineHeight: 1.4, textWrap: 'pretty' }}>
        Найди мафию раньше, чем она найдёт тебя
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexDirection: desktop ? 'row' : 'column', width: desktop ? 'auto' : '100%' }}>
        <button className="mf-btn mf-btn-crimson" type="button" style={{ minWidth: desktop ? 220 : undefined }}>Создать комнату</button>
        <button className="mf-btn mf-btn-ghost" type="button" style={{ minWidth: desktop ? 180 : undefined }}>Войти по коду</button>
      </div>
      <div style={{ display: 'flex', gap: 14, color: 'var(--mf-text-faint)', fontSize: 13, fontWeight: 700, marginTop: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><LIcon name="Users" size={14} />5–16 игроков</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><LIcon name="Wifi" size={14} />Онлайн</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><LIcon name="Bot" size={14} />Автоведущий</span>
      </div>
    </div>
  );
}

function LandingSteps({ desktop }) {
  return (
    <div style={{ padding: desktop ? '0 64px' : '0 20px' }}>
      <h2 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: desktop ? 30 : 23, letterSpacing: '-0.02em' }}>Как играть</h2>
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(4, 1fr)' : '1fr', gap: 12 }}>
        {LANDING_STEPS.map(([icon, t, s], i) => (
          <div key={t} style={{
            background: 'var(--mf-surface)', border: '1px solid var(--mf-border)',
            borderRadius: 'var(--r-card)', padding: '18px 16px',
            display: 'flex', flexDirection: desktop ? 'column' : 'row', gap: 13, alignItems: desktop ? 'flex-start' : 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="mf-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--mf-crimson)' }}>0{i + 1}</span>
              <LIcon name={icon} size={21} color="var(--mf-text-dim)" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15.5 }}>{t}</div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--mf-text-faint)', marginTop: 3, lineHeight: 1.45, textWrap: 'pretty' }}>{s}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingRoles({ desktop }) {
  return (
    <div style={{ padding: desktop ? '40px 64px 56px' : '32px 20px 36px' }}>
      <h2 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: desktop ? 30 : 23, letterSpacing: '-0.02em' }}>Роли</h2>
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(3, 1fr)' : '1fr 1fr', gap: 12 }}>
        {LANDING_ROLES.map(([key, desc]) => {
          const r = ROLES[key];
          const isDon = key === 'don';
          return (
            <div key={key} style={{
              background: 'var(--mf-surface)', borderRadius: 'var(--r-card)',
              border: `1.5px solid ${isDon ? 'var(--mf-gold)' : 'color-mix(in srgb, ' + r.color + ' 35%, transparent)'}`,
              padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `color-mix(in srgb, ${r.color} 12%, transparent)`, color: r.color,
              }}>
                <LIcon name={r.icon} size={22} strokeWidth={1.8} />
              </div>
              <div style={{ fontWeight: 800, fontSize: 17, color: r.color }}>{r.label}</div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--mf-text-dim)', lineHeight: 1.45, textWrap: 'pretty' }}>{desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MafiaLanding({ desktop }) {
  return (
    <div className="mf-screen mf-vignette" data-screen-label="Лендинг Мафии" style={{ overflow: 'visible', height: 'auto', minHeight: '100%' }}>
      <LandingHero desktop={desktop} />
      <LandingSteps desktop={desktop} />
      <LandingRoles desktop={desktop} />
    </div>
  );
}

Object.assign(window, { MafiaLanding });
