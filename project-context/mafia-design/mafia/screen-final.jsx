// Финал: экран зрителя и итоги партии (3 варианта шапки, мобайл + десктоп)
const FINAL_ROLES = [
  ['Иван', 0, 'civilian', 'убит ночью 2', true],
  ['Кира', 1, 'doctor', 'жива', false],
  ['Стас', 2, 'don', 'изгнан днём 4', true],
  ['Маша', 3, 'civilian', 'убита ночью 3', true],
  ['Пётр', 4, 'mafia', 'изгнан днём 2', true],
  ['Лена', 5, 'mafia', 'изгнана днём 3', true],
  ['Артём', 6, 'civilian', 'жив', false],
  ['Оля', 7, 'sheriff', 'жива', false],
  ['Гоша', 8, 'civilian', 'убит ночью 1', true],
];

const CHRONICLE = [
  ['Ночь 1', 'Мафия убила Гошу', 'Moon'],
  ['День 1', 'Без голосования — первый день', 'Sun'],
  ['Ночь 2', 'Погиб Иван · Доктор лечил Олю', 'Moon'],
  ['День 2', 'Изгнан Пётр — Мафия', 'Vote'],
  ['Ночь 3', 'Убита Маша · Шериф проверил Лену', 'Moon'],
  ['День 3', 'Изгнана Лена — Мафия', 'Vote'],
  ['Ночь 4', 'Все выжили — Доктор спас Артёма', 'Moon'],
  ['День 4', 'Изгнан Стас — Дон. Город победил', 'Trophy'],
];

const WINNERS = {
  city:   { title: 'Победа города', color: 'var(--mf-gold)', icon: 'Trophy', glow: 'var(--sh-glow-gold)' },
  mafia:  { title: 'Мафия захватила город', color: 'var(--mf-crimson)', icon: 'VenetianMask', glow: 'var(--sh-glow-crimson)' },
  maniac: { title: 'Маньяк остался один', color: 'var(--role-maniac)', icon: 'Skull', glow: '0 0 36px rgba(168,85,247,0.35)' },
};

function WinnerHead({ winner, desktop }) {
  const w = WINNERS[winner];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: desktop ? '44px 0 8px' : '40px 24px 6px', textAlign: 'center' }}>
      <div style={{
        width: 84, height: 84, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `color-mix(in srgb, ${w.color} 12%, transparent)`,
        border: `1.5px solid ${w.color}`, color: w.color, boxShadow: w.glow,
      }}>
        <LIcon name={w.icon} size={40} strokeWidth={1.5} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mf-text-faint)' }}>Партия окончена</div>
      <div style={{ fontWeight: 800, fontSize: desktop ? 52 : 34, letterSpacing: '-0.02em', lineHeight: 1.1, color: w.color, textShadow: `0 0 50px color-mix(in srgb, ${w.color} 45%, transparent)`, textWrap: 'balance' }}>{w.title}</div>
    </div>
  );
}

function RolesTable() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {FINAL_ROLES.map(([name, idx, role, fate, dead]) => (
        <div key={name} style={{
          display: 'flex', alignItems: 'center', gap: 11,
          background: 'var(--mf-surface)', border: '1px solid var(--mf-border)',
          borderRadius: 14, padding: '8px 12px', opacity: dead ? 0.75 : 1,
        }}>
          <Avatar name={name} idx={idx} size={32} dead={dead} />
          <span style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0 }}>{name}</span>
          <RoleChip role={role} />
          <span className="mf-mono" style={{ fontSize: 11.5, color: 'var(--mf-text-faint)', fontWeight: 700, whiteSpace: 'nowrap' }}>{fate}</span>
        </div>
      ))}
    </div>
  );
}

function Chronicle() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {CHRONICLE.map(([phase, text, icon], i) => (
        <div key={phase} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'stretch' }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--mf-surface-2)', border: '1px solid var(--mf-border)',
              color: icon === 'Trophy' ? 'var(--mf-gold)' : 'var(--mf-text-faint)', flexShrink: 0,
            }}>
              <LIcon name={icon} size={14} />
            </div>
            {i < CHRONICLE.length - 1 ? <div style={{ width: 1, flex: 1, background: 'var(--mf-border)', minHeight: 12 }}></div> : null}
          </div>
          <div style={{ paddingBottom: 14 }}>
            <div className="mf-mono" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--mf-text-faint)' }}>{phase}</div>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--mf-text-dim)', marginTop: 1, lineHeight: 1.4 }}>{text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FinalButtons({ row }) {
  return (
    <div style={{ display: 'flex', flexDirection: row ? 'row' : 'column', gap: 10, justifyContent: 'center' }}>
      <button className="mf-btn mf-btn-crimson" type="button" style={{ minWidth: row ? 200 : undefined }}>Сыграть ещё</button>
      <button className="mf-btn mf-btn-surface" type="button" style={{ minWidth: row ? 150 : undefined }}>В лобби</button>
      <button className="mf-btn mf-btn-ghost" type="button" style={{ minWidth: row ? 150 : undefined }}>На главную</button>
    </div>
  );
}

function GameOver({ winner = 'city', headerOnly }) {
  return (
    <div className="mf-screen mf-vignette" data-screen-label={'Итоги — ' + WINNERS[winner].title} style={{ height: 'auto', minHeight: '100%', overflow: 'visible' }}>
      <WinnerHead winner={winner} />
      {!headerOnly ? (
        <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 10 }}>Роли и судьбы</div>
            <RolesTable />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 10 }}>Хроника партии</div>
            <Chronicle />
          </div>
        </div>
      ) : (
        <div style={{ padding: '14px 24px 0', textAlign: 'center', fontWeight: 600, fontSize: 14, color: 'var(--mf-text-dim)' }}>
          {winner === 'mafia' ? 'Город не вычислил последнего мафиози' : 'Третья сила пережила всех'}
        </div>
      )}
      <div style={{ padding: '24px 20px 22px', marginTop: headerOnly ? 'auto' : 0 }}>
        <FinalButtons />
      </div>
    </div>
  );
}

function GameOverDesktop() {
  return (
    <div className="mf-screen mf-vignette" data-screen-label="Итоги — десктоп" style={{ height: 'auto', minHeight: '100%', overflow: 'visible' }}>
      <WinnerHead winner="city" desktop />
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 48, padding: '28px 80px 0' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 12 }}>Роли и судьбы</div>
          <RolesTable />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 12 }}>Хроника партии</div>
          <Chronicle />
        </div>
      </div>
      <div style={{ padding: '30px 0 32px' }}>
        <FinalButtons row />
      </div>
    </div>
  );
}

// --- Экран зрителя ---
const SPECTATOR_ROLES = { 'Иван': 'civilian', 'Кира': 'doctor', 'Стас': 'don', 'Маша': 'civilian', 'Пётр': 'mafia', 'Лена': 'mafia', 'Артём': 'civilian', 'Оля': 'sheriff', 'Гоша': 'civilian' };
const SPECTATOR_DEAD = ['Гоша', 'Иван'];
const NIGHT_FEED = [
  ['HeartPulse', 'var(--role-doctor)', 'Доктор лечил Машу'],
  ['Search', 'var(--role-sheriff)', 'Шериф проверил Лену — мафия'],
  ['VenetianMask', 'var(--role-mafia)', 'Мафия выбирает жертву…'],
];

function Spectator() {
  return (
    <div className="mf-screen mf-vignette" data-screen-label="Зритель" style={{ height: 'auto', minHeight: '100%', overflow: 'visible' }}>
      <div className="mf-phase-head">
        <div className="mf-phase-title">
          <LIcon name="Eye" size={21} color="var(--mf-text-dim)" />
          <span>Ночь 3</span>
        </div>
        <span className="mf-chip" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <LIcon name="Eye" size={13} />Ты зритель
        </span>
      </div>
      <div style={{ padding: '14px 20px 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 9 }}>Сейчас</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {NIGHT_FEED.map(([icon, color, text]) => (
              <div key={text} style={{
                display: 'flex', alignItems: 'center', gap: 11,
                background: 'var(--mf-surface)', border: '1px solid var(--mf-border)',
                borderRadius: 13, padding: '10px 13px',
              }}>
                <LIcon name={icon} size={17} color={color} />
                <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--mf-text-dim)' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 9 }}>Игроки и роли</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 20 }}>
            {PLAYERS.map(p => {
              const dead = SPECTATOR_DEAD.includes(p.name);
              return (
                <div key={p.name} style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  background: 'var(--mf-surface)', border: '1px solid var(--mf-border)',
                  borderRadius: 13, padding: '8px 12px', opacity: dead ? 0.55 : 1,
                }}>
                  <Avatar name={p.name} idx={p.idx} size={32} dead={dead} />
                  <span style={{ fontWeight: 700, fontSize: 14, flex: 1, textDecoration: dead ? 'line-through' : 'none' }}>{p.name}</span>
                  <RoleChip role={SPECTATOR_ROLES[p.name]} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { GameOver, GameOverDesktop, Spectator });
