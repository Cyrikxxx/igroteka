// Главный экран Алиаса — герой с карточкой слова, «Как играть», наборы слов. Мобайл + десктоп.
const ALIAS_STEPS = [
  ['Users2', 'Собери команды', 'Два и больше — раздели друзей поровну'],
  ['MessageSquareText', 'Объясняй слово', 'Любыми словами, кроме однокоренных'],
  ['Zap', 'Команда угадывает', 'Свайп вправо — верно, влево — пропуск'],
  ['Trophy', 'Считай очки', 'Первая команда до 50 очков забирает партию'],
];

const ALIAS_PACKS = [
  ['Классика', 'Book', 'var(--pack-classic)', '1200 слов', 'Простые слова на каждый день'],
  ['Для своих', 'Flame', 'var(--pack-friends)', '640 слов', 'Мемы, сленг и неловкие темы'],
  ['Детский', 'ToyBrick', 'var(--pack-kids)', '480 слов', 'Без сложных понятий, от 6 лет'],
  ['Кино', 'Clapperboard', 'var(--pack-movies)', '520 слов', 'Фильмы, сериалы и герои'],
  ['Профессии', 'Briefcase', 'var(--pack-pro)', '350 слов', 'Кем работают и что делают'],
  ['Хардкор', 'Skull', 'var(--pack-hard)', '300 слов', 'Абстракции, термины, редкие слова'],
];

function WordCard({ desktop }) {
  return (
    <div style={{
      width: desktop ? 300 : 250, background: 'var(--al-surface)', border: '1.5px solid rgba(34,197,94,0.35)',
      borderRadius: 'var(--r-card)', padding: desktop ? '24px 22px' : '20px 18px',
      boxShadow: '0 18px 50px rgba(0,0,0,0.5), 0 0 40px rgba(34,197,94,0.12)',
      transform: 'rotate(-3deg)', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="al-chip" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--al-green)' }}>Классика</span>
        <span className="mf-timer" style={{ fontSize: 17, color: 'var(--al-text-dim)' }}>0:38</span>
      </div>
      <div style={{ fontWeight: 800, fontSize: desktop ? 40 : 34, letterSpacing: '-0.02em', lineHeight: 1 }}>Маяк</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--al-text-faint)' }}>Нельзя говорить</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['море', 'свет', 'корабль'].map(w => (
            <span key={w} className="al-chip" style={{ fontSize: 12, padding: '4px 10px', color: 'var(--al-text-faint)' }}>{w}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function AliasHero({ desktop }) {
  const text = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: desktop ? 'flex-start' : 'center', textAlign: desktop ? 'left' : 'center', gap: 16 }}>
      <span className="al-chip" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--al-green-hover)' }}>
        <LIcon name="Sparkles" size={14} />Классика в Игротеке
      </span>
      <div style={{ fontWeight: 800, fontSize: desktop ? 104 : 62, letterSpacing: '0.03em', lineHeight: 1, color: 'var(--al-green)', textShadow: '0 0 60px rgba(34,197,94,0.35)' }}>АЛИАС</div>
      <div style={{ fontWeight: 700, fontSize: desktop ? 22 : 17, color: 'var(--al-text-dim)', maxWidth: 440, lineHeight: 1.4, textWrap: 'pretty' }}>
        Объясняй слова на время — команда угадывает
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexDirection: desktop ? 'row' : 'column', width: desktop ? 'auto' : '100%' }}>
        <button className="mf-btn mf-btn-green" type="button" style={{ minWidth: desktop ? 210 : undefined }}>На одном устройстве</button>
        <button className="mf-btn mf-btn-surface" type="button" style={{ minWidth: desktop ? 190 : undefined }}>Онлайн-комната</button>
        <button className="mf-btn mf-btn-ghost" type="button" style={{ minWidth: desktop ? 160 : undefined }}>Войти по коду</button>
      </div>
      <div style={{ display: 'flex', gap: 14, color: 'var(--al-text-faint)', fontSize: 13, fontWeight: 700, marginTop: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><LIcon name="Users" size={14} />2–6 команд</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><LIcon name="Smartphone" size={14} />Один телефон или онлайн</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><LIcon name="Timer" size={14} />Раунд 60 сек</span>
      </div>
    </div>
  );
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: desktop ? 'space-between' : 'center',
      flexDirection: desktop ? 'row' : 'column', gap: desktop ? 48 : 34,
      padding: desktop ? '68px 64px 56px' : '52px 24px 40px',
    }}>
      {text}
      <WordCard desktop={desktop} />
    </div>
  );
}

function AliasSteps({ desktop }) {
  return (
    <div style={{ padding: desktop ? '0 64px' : '0 20px' }}>
      <h2 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: desktop ? 30 : 23, letterSpacing: '-0.02em' }}>Как играть</h2>
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(4, 1fr)' : '1fr', gap: 12 }}>
        {ALIAS_STEPS.map(([icon, t, s], i) => (
          <div key={t} className="al-card" style={{
            padding: '18px 16px', display: 'flex',
            flexDirection: desktop ? 'column' : 'row', gap: 13, alignItems: desktop ? 'flex-start' : 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="mf-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--al-green)' }}>0{i + 1}</span>
              <LIcon name={icon} size={21} color="var(--al-text-dim)" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15.5 }}>{t}</div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--al-text-faint)', marginTop: 3, lineHeight: 1.45, textWrap: 'pretty' }}>{s}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AliasPacks({ desktop }) {
  return (
    <div style={{ padding: desktop ? '40px 64px 56px' : '32px 20px 36px' }}>
      <h2 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: desktop ? 30 : 23, letterSpacing: '-0.02em' }}>Наборы слов</h2>
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(3, 1fr)' : '1fr 1fr', gap: 12 }}>
        {ALIAS_PACKS.map(([name, icon, color, count, desc]) => (
          <div key={name} className="al-card" style={{
            border: `1.5px solid color-mix(in srgb, ${color} 35%, transparent)`,
            padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `color-mix(in srgb, ${color} 12%, transparent)`, color,
            }}>
              <LIcon name={icon} size={22} strokeWidth={1.8} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: 17, color }}>{name}</span>
              <span className="mf-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--al-text-faint)' }}>{count}</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--al-text-dim)', lineHeight: 1.45, textWrap: 'pretty' }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AliasLanding({ desktop }) {
  return (
    <div className="al-screen al-vignette" data-screen-label="Главный экран Алиаса" style={{ overflow: 'visible', height: 'auto', minHeight: '100%' }}>
      <AliasHero desktop={desktop} />
      <AliasSteps desktop={desktop} />
      <AliasPacks desktop={desktop} />
    </div>
  );
}

Object.assign(window, { AliasLanding });
