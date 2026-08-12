// Общая история игр — Алиас + Мафия. Нейтральная чернильная подложка платформы, акцент — по игре.
const HIST_GAMES = [
  { id: 1, game: 'alias', mode: 'online', status: 'live', teams: [['Команда 1', 5], ['Команда 2', 3]], meta: '2 раунда' },
  { id: 2, game: 'mafia', mode: 'online', status: 'live', players: 9, alive: 6, phase: 'Ночь 3', meta: '3 ночи' },
  { id: 3, game: 'alias', mode: 'local', status: 'live', teams: [['Лисы', 7], ['Совы', 0]], meta: '1 раунд' },
  { id: 4, game: 'mafia', mode: 'online', status: 'done', players: 12, winner: 'mafia', meta: '4 ночи' },
  { id: 5, game: 'alias', mode: 'local', status: 'done', teams: [['Лисы', 10], ['Совы', 6]], meta: '3 раунда' },
  { id: 6, game: 'mafia', mode: 'online', status: 'done', players: 7, winner: 'city', meta: '2 ночи' },
  { id: 7, game: 'alias', mode: 'local', status: 'done', teams: [['Лисы', 4], ['Совы', 2]], meta: '2 раунда' },
];

const HIST_THEME = {
  alias: { accent: 'var(--al-green)', hover: 'var(--al-green-hover)', dark: true, label: 'Алиас', icon: 'Sparkles' },
  mafia: { accent: 'var(--mf-crimson)', hover: 'var(--mf-crimson-hover)', dark: false, label: 'Мафия', icon: 'VenetianMask' },
};

function HistTopBar({ desktop }) {
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
          <span>О нас</span><span>Правила</span><span style={{ color: 'var(--mf-text)' }}>История</span><span>Поддержка</span>
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

function HistStat({ value, label, color, desktop }) {
  return (
    <div style={{
      background: 'var(--ink-surface)', border: '1px solid var(--ink-border)', borderRadius: 'var(--r-card)',
      padding: desktop ? '22px 24px' : '16px 18px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1,
    }}>
      <div className="mf-mono" style={{ fontWeight: 700, fontSize: desktop ? 38 : 30, lineHeight: 1, color: color || 'var(--mf-text)' }}>{value}</div>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mf-text-faint)' }}>{label}</div>
    </div>
  );
}

function HistTeamRow({ name, score, dot }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'rgba(255,255,255,0.035)', borderRadius: 12, padding: '10px 14px',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 700, fontSize: 14.5 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }}></span>{name}
      </span>
      <span className="mf-mono" style={{ fontWeight: 700, fontSize: 15 }}>{score}</span>
    </div>
  );
}

function HistMafiaBody({ g }) {
  const win = g.winner === 'mafia';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.035)', borderRadius: 12, padding: '10px 14px',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 700, fontSize: 14.5 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: g.status === 'live' ? 'var(--mf-gold)' : (win ? 'var(--mf-crimson)' : 'var(--role-civilian)'),
          }}></span>
          {g.status === 'live' ? g.phase : (win ? 'Победа мафии' : 'Победа мирных')}
        </span>
        <span className="mf-mono" style={{ fontWeight: 700, fontSize: 13, color: 'var(--mf-text-faint)' }}>
          {g.status === 'live' ? `${g.alive}/${g.players} в игре` : `${g.players} игроков`}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px' }}>
        {PLAYERS.slice(0, 6).map((p, i) => (
          <Avatar key={p.name} name={p.name} idx={p.idx} size={26} dead={g.status === 'done' && i > 2} />
        ))}
        <span className="mf-mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mf-text-faint)', marginLeft: 2 }}>
          +{g.players - 6}
        </span>
      </div>
    </div>
  );
}

function HistCard({ g }) {
  const t = HIST_THEME[g.game];
  const live = g.status === 'live';
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: 'var(--ink-surface)',
      border: '1px solid var(--ink-border)',
      borderTop: `3px solid ${live ? t.accent : `color-mix(in srgb, ${t.accent} 45%, var(--ink-surface))`}`,
      borderRadius: 'var(--r-card)', padding: '15px 16px 14px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 15, color: t.accent }}>
          <LIcon name={t.icon} size={16} />{t.label}
        </span>
        <span className="mf-mono" style={{
          display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700,
          letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mf-text-faint)',
        }}>
          <LIcon name={g.mode === 'online' ? 'Wifi' : 'Smartphone'} size={12} />
          {g.mode === 'online' ? 'Онлайн' : 'Локально'}
        </span>
      </div>
      {g.game === 'alias' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {g.teams.map(([name, score], i) => (
            <HistTeamRow key={name} name={name} score={score} dot={i === 0 ? 'var(--al-green)' : 'var(--mf-gold)'} />
          ))}
        </div>
      ) : <HistMafiaBody g={g} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 'auto', paddingTop: 2 }}>
        <span className="mf-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--mf-text-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>{g.meta}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" className="mf-btn" style={{
            minHeight: 40, padding: '0 14px', fontSize: 14, borderRadius: 12, whiteSpace: 'nowrap',
            background: live ? t.accent : 'transparent',
            color: live ? (t.dark ? '#06130a' : '#fff') : 'var(--mf-text-dim)',
            border: live ? 'none' : '1px solid var(--ink-border)',
          }}>
            <LIcon name={live ? 'Play' : 'ScrollText'} size={16} />{live ? 'Продолжить' : 'Итоги'}
          </button>
          <button type="button" style={{
            width: 40, height: 40, borderRadius: 12, background: 'transparent',
            border: '1px solid var(--ink-border)', color: 'var(--mf-text-faint)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <LIcon name="Trash2" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function HistFilters({ value, onChange }) {
  const items = [['all', 'Все', 'var(--mf-text)'], ['alias', 'Алиас', 'var(--al-green)'], ['mafia', 'Мафия', 'var(--mf-crimson)']];
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {items.map(([k, label, color]) => {
        const on = value === k;
        return (
          <button key={k} type="button" onClick={() => onChange(k)} style={{
            fontFamily: 'var(--font-main)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
            padding: '8px 16px', borderRadius: 999,
            background: on ? `color-mix(in srgb, ${color} 14%, transparent)` : 'transparent',
            border: `1px solid ${on ? `color-mix(in srgb, ${color} 45%, transparent)` : 'var(--ink-border)'}`,
            color: on ? color : 'var(--mf-text-faint)',
          }}>{label}</button>
        );
      })}
    </div>
  );
}

function HistoryScreen({ desktop }) {
  const [filter, setFilter] = React.useState('all');
  const games = HIST_GAMES.filter(g => filter === 'all' || g.game === filter);
  const pad = desktop ? '0 56px' : '0 20px';
  return (
    <div className="mf-screen" data-screen-label="История игр" style={{
      background: 'var(--ink-bg)', overflow: 'visible', height: 'auto', minHeight: '100%', paddingBottom: 40,
    }}>
      <HistTopBar desktop={desktop} />
      <div style={{ padding: pad, marginTop: desktop ? 34 : 24, display: 'flex', flexDirection: 'column', gap: desktop ? 26 : 20 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--mf-text-dim)' }}>
          <LIcon name="ArrowLeft" size={16} />На главную
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: desktop ? 58 : 38, letterSpacing: '-0.03em', lineHeight: 1 }}>История игр</h1>
          <p style={{ margin: 0, fontSize: desktop ? 16.5 : 14.5, fontWeight: 600, color: 'var(--mf-text-dim)', maxWidth: 640, lineHeight: 1.45, textWrap: 'pretty' }}>
            Партии Алиаса и Мафии в одном списке — незавершённую игру можно открыть и доиграть.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexDirection: desktop ? 'row' : 'column' }}>
          <HistStat desktop={desktop} value="12" label="Сыграно партий" />
          <HistStat desktop={desktop} value="31" label="Угадано слов в Алиасе" color="var(--al-green)" />
          <HistStat desktop={desktop} value="4" label="Побед за мафию" color="var(--mf-crimson)" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <HistFilters value={filter} onChange={setFilter} />
          <span className="mf-mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mf-text-faint)' }}>{games.length} из {HIST_GAMES.length}</span>
        </div>
        <div style={{
          display: 'grid', gap: 14,
          gridTemplateColumns: desktop ? 'repeat(3, 1fr)' : '1fr',
        }}>
          {games.map(g => <HistCard key={g.id} g={g} />)}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HistoryScreen });
