// Ночь — вид мафии (390×844). Тап по живому игроку = голос за жертву.
function NightMafia({ vignette = 0.16 }) {
  const [pick, setPick] = React.useState(4); // Пётр
  const alive = PLAYERS.slice(0, 8); // 8 живых
  const me = 'Кира';
  const partners = ['Кира', 'Стас']; // мафия: я (Кира) + Стас, Дон — кто-то из них
  const partnerVotes = { 'Стас': 4 }; // Стас тоже голосует за Петра

  return (
    <div className="mf-screen mf-vignette" style={{ '--vignette': vignette }} data-screen-label="Ночь — мафия">
      <PhaseHead icon="Moon" title="Ночь 2" timer="0:42" />
      <div style={{ padding: '6px 20px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--mf-text-dim)' }}>Выбери, кого мафия уберёт этой ночью</div>
        <div className="mf-chip" style={{ alignSelf: 'flex-start', background: 'rgba(245,158,11,0.12)', color: 'var(--mf-gold)' }}>
          <LIcon name="Crown" size={14} />
          Дон — решающий голос
        </div>
      </div>

      <div className="mf-player-grid" style={{ flex: 1, alignContent: 'start' }}>
        {alive.map((p, i) => {
          const isPartner = partners.includes(p.name);
          const isMe = p.name === me;
          const picked = pick === i;
          const partnerVoter = Object.keys(partnerVotes).find(k => partnerVotes[k] === i);
          return (
            <div key={p.name}
              className={'mf-player-card' + (picked ? ' picked' : '') + (isPartner ? ' disabled' : '')}
              onClick={() => !isPartner && setPick(picked ? null : i)}
              style={isPartner ? { opacity: 1, background: 'rgba(225,29,72,0.05)', borderColor: 'rgba(225,29,72,0.3)', cursor: 'default' } : null}>
              <Avatar name={p.name} idx={p.idx} size={42} />
              <div className="mf-player-name">{p.name}{isMe ? ' (ты)' : ''}</div>
              {isPartner && !isMe ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--mf-crimson)' }}>
                  <LIcon name="VenetianMask" size={13} />напарник
                </div>
              ) : null}
              {picked ? (
                <div className="mf-chip" style={{ position: 'absolute', top: -9, right: 10, background: 'var(--mf-crimson)', color: '#fff', fontSize: 11, padding: '3px 9px' }}>твой голос</div>
              ) : null}
              {partnerVoter ? (
                <div className="mf-chip" style={{ position: 'absolute', top: -9, left: 10, background: 'rgba(225,29,72,0.2)', color: 'var(--mf-crimson-hover)', fontSize: 11, padding: '3px 9px' }}>
                  {partnerVoter} ✓
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '14px 20px 18px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          background: 'var(--mf-surface)', border: '1px solid var(--mf-border)',
          borderRadius: 14, padding: '13px 16px', fontSize: 14, fontWeight: 700,
          color: pick != null ? 'var(--mf-text-dim)' : 'var(--mf-text-faint)',
        }}>
          {pick != null ? (
            <React.Fragment>
              <LIcon name="Check" size={17} color="var(--mf-crimson)" />
              Ход принят. Ждём остальных…
            </React.Fragment>
          ) : (
            <React.Fragment>
              <LIcon name="MousePointerClick" size={17} />
              Тапни по игроку, чтобы проголосовать
            </React.Fragment>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { NightMafia });
