// Дневной цикл: утро, ты убит, обсуждение, результат голосования, переголосование, последнее слово
function Announce({ label, kicker, title, titleColor, glow, icon, iconColor, children, footer }) {
  return (
    <div className="mf-screen mf-vignette" data-screen-label={label}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 28px', textAlign: 'center' }}>
        {icon ? (
          <div style={{
            width: 96, height: 96, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--mf-border)',
            color: iconColor || 'var(--mf-text-dim)',
            boxShadow: glow || 'none',
          }}>
            <LIcon name={icon} size={44} strokeWidth={1.4} />
          </div>
        ) : null}
        {kicker ? <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--mf-text-faint)' }}>{kicker}</div> : null}
        <div style={{ fontWeight: 800, fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1.15, color: titleColor || 'var(--mf-text)', textWrap: 'balance' }}>{title}</div>
        {children}
      </div>
      {footer ? <div style={{ padding: '0 20px 20px' }}>{footer}</div> : null}
    </div>
  );
}

function MorningDeath() {
  return (
    <Announce label="Утро — погиб игрок" kicker="Город просыпается…" title="Этой ночью погиб Иван"
      icon="Sunrise" iconColor="var(--mf-crimson)" glow="var(--sh-glow-crimson)"
      footer={<div className="mf-mono" style={{ textAlign: 'center', fontSize: 13, color: 'var(--mf-text-faint)', fontWeight: 700 }}>обсуждение начнётся через 0:05</div>}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--mf-surface)', border: '1px solid var(--mf-border)', borderRadius: 16, padding: '12px 18px' }}>
        <Avatar name="Иван" idx={0} size={42} dead />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Иван</div>
          <RoleChip role="civilian" />
        </div>
      </div>
    </Announce>
  );
}

function MorningAllAlive() {
  return (
    <Announce label="Утро — все выжили" kicker="Город просыпается…" title="Этой ночью все выжили"
      icon="Sun" iconColor="var(--mf-gold)" glow="var(--sh-glow-gold)"
      footer={<div className="mf-mono" style={{ textAlign: 'center', fontSize: 13, color: 'var(--mf-text-faint)', fontWeight: 700 }}>обсуждение начнётся через 0:05</div>}>
      <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--mf-text-dim)' }}>Похоже, кому-то этой ночью повезло</div>
    </Announce>
  );
}

function YouDead({ exiled }) {
  return (
    <Announce label={exiled ? 'Город изгнал тебя' : 'Ты убит'}
      kicker={exiled ? 'Голосование окончено' : null}
      title={exiled ? 'Город изгнал тебя' : 'Ты убит'} titleColor="var(--mf-crimson)"
      icon="Skull" iconColor="var(--mf-crimson)" glow="var(--sh-glow-crimson)"
      footer={<button className="mf-btn mf-btn-surface" type="button" style={{ width: '100%' }}>Смотреть как зритель<LIcon name="Eye" size={18} /></button>}>
      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--mf-text-dim)', lineHeight: 1.5 }}>{exiled ? 'Голоса сошлись на тебе.' : 'Этой ночью тебя не стало.'}<br />Не выдавай свою роль голосом — игра продолжается.</div>
    </Announce>
  );
}

// --- Обсуждение ---
function Discussion({ host = true }) {
  const dead = { 'Гоша': 'civilian', 'Иван': 'civilian' };
  return (
    <div className="mf-screen" data-screen-label="Обсуждение">
      <PhaseHead icon="MessagesSquare" title="День 2 — обсуждение" />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0 8px' }}>
        <div className="mf-timer" style={{ fontSize: 64, lineHeight: 1 }}>1:37</div>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--mf-text-faint)', marginTop: 6 }}>Говорите голосом — телефон подождёт</div>
      </div>
      <div style={{ padding: '14px 20px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: 7, minHeight: 0 }}>
        {PLAYERS.map(p => {
          const deadRole = dead[p.name];
          return (
            <div key={p.name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--mf-surface)', border: '1px solid var(--mf-border)',
              borderRadius: 14, padding: '8px 12px', opacity: deadRole ? 0.5 : 1,
            }}>
              <Avatar name={p.name} idx={p.idx} size={34} dead={!!deadRole} />
              <span style={{ fontWeight: 700, fontSize: 14.5, flex: 1, textDecoration: deadRole ? 'line-through' : 'none', color: deadRole ? 'var(--mf-text-faint)' : 'var(--mf-text)' }}>{p.name}</span>
              {deadRole ? <RoleChip role={deadRole} /> : null}
            </div>
          );
        })}
      </div>
      <div style={{ padding: '12px 20px 18px' }}>
        {host
          ? <button className="mf-btn mf-btn-crimson" type="button" style={{ width: '100%' }}>Завершить обсуждение</button>
          : <div className="mf-mono" style={{ textAlign: 'center', fontSize: 13, color: 'var(--mf-text-faint)', fontWeight: 700 }}>хост может завершить раньше</div>}
      </div>
    </div>
  );
}

// --- Результат голосования ---
function VoteResult({ tie }) {
  if (tie) {
    return (
      <Announce label="Результат — ничья" kicker="Голосование окончено" title="Голоса разделились — никто не выбывает"
        icon="Scale" iconColor="var(--mf-text-dim)"
        footer={<div className="mf-mono" style={{ textAlign: 'center', fontSize: 13, color: 'var(--mf-text-faint)', fontWeight: 700 }}>ночь начнётся через 0:05</div>}>
        <div style={{ display: 'flex', gap: 10 }}>
          {[['Пётр', 4, 3], ['Стас', 2, 3]].map(([n, idx, v]) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--mf-surface)', border: '1px solid var(--mf-border)', borderRadius: 14, padding: '9px 14px' }}>
              <Avatar name={n} idx={idx} size={32} />
              <span style={{ fontWeight: 700, fontSize: 14.5 }}>{n}</span>
              <span className="mf-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--mf-text-dim)' }}>{v}</span>
            </div>
          ))}
        </div>
      </Announce>
    );
  }
  return (
    <Announce label="Результат — изгнание" kicker="Голосование окончено" title={<span>Город изгоняет <span style={{ color: 'var(--mf-crimson)' }}>Петра</span></span>}
      icon="Vote" iconColor="var(--mf-crimson)" glow="var(--sh-glow-crimson)"
      footer={<div className="mf-mono" style={{ textAlign: 'center', fontSize: 13, color: 'var(--mf-text-faint)', fontWeight: 700 }}>последнее слово — 30 секунд</div>}>
      <div className="mf-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--mf-text-dim)' }}>5 голосов из 7</div>
    </Announce>
  );
}

// --- Переголосование: только лидеры ---
function Revote() {
  const [pick, setPick] = React.useState(null);
  const leaders = [{ name: 'Пётр', idx: 4, votes: 3 }, { name: 'Стас', idx: 2, votes: 3 }];
  return (
    <div className="mf-screen" data-screen-label="Переголосование">
      <PhaseHead icon="RotateCcw" title="Переголосование" timer="0:30" />
      <div style={{ padding: '8px 20px 18px' }}>
        <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em' }}>Голоса разделились</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--mf-text-dim)', marginTop: 4 }}>Выбирайте между лидерами</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px', justifyContent: 'center' }}>
        {leaders.map((p, i) => (
          <div key={p.name} className={'mf-player-card' + (pick === i ? ' picked' : '')}
            onClick={() => setPick(pick === i ? null : i)}
            style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 16, padding: '18px 20px', minHeight: 0 }}>
            <Avatar name={p.name} idx={p.idx} size={52} />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontWeight: 800, fontSize: 19 }}>{p.name}</div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--mf-text-faint)' }}>в первом туре — {p.votes} голоса</div>
            </div>
            {pick === i ? <LIcon name="Check" size={22} color="var(--mf-crimson)" /> : null}
          </div>
        ))}
      </div>
      <div style={{ padding: '14px 20px 18px' }}>
        <button className="mf-btn mf-btn-ghost" type="button" style={{ width: '100%' }}>Воздержаться</button>
      </div>
    </div>
  );
}

// --- Последнее слово ---
function LastWord({ self }) {
  if (self) {
    return (
      <Announce label="Последнее слово — Пётр" kicker="Город слушает только тебя" title="Твоё последнее слово"
        icon="Mic" iconColor="var(--mf-gold)" glow="var(--sh-glow-gold)"
        footer={<button className="mf-btn mf-btn-crimson" type="button" style={{ width: '100%' }}>Я всё сказал</button>}>
        <div className="mf-timer" style={{ fontSize: 56, lineHeight: 1 }}>0:24</div>
      </Announce>
    );
  }
  return (
    <Announce label="Последнее слово" kicker="Город слушает" title={<span>Последнее слово: <span style={{ color: 'var(--mf-gold)' }}>Пётр</span></span>}
      icon="Mic" iconColor="var(--mf-gold)" glow="var(--sh-glow-gold)"
      footer={<div className="mf-mono" style={{ textAlign: 'center', fontSize: 13, color: 'var(--mf-text-faint)', fontWeight: 700 }}>после — раскрытие роли</div>}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <Avatar name="Пётр" idx={4} size={64} />
        <div className="mf-timer" style={{ fontSize: 48, lineHeight: 1 }}>0:24</div>
      </div>
    </Announce>
  );
}

Object.assign(window, { Announce, MorningDeath, MorningAllAlive, YouDead, Discussion, VoteResult, Revote, LastWord });
