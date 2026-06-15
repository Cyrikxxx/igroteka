// Дневное голосование (390×844). Тап = голос, можно менять.
function VoteDay() {
  const [myVote, setMyVote] = React.useState(3); // Пётр
  // Живых 7: Гоша погиб ночью 1, Иван — ночью 2
  const alive = PLAYERS.slice(1, 8);
  // базовые голоса других игроков (индексы целей): итог — Пётр 5 из 7
  const baseVotes = { 3: 4, 1: 1, 5: 1 };

  const counts = { ...baseVotes };
  if (myVote != null) counts[myVote] = (counts[myVote] || 0) + 1;
  const max = Math.max(...Object.values(counts), 0);

  return (
    <div className="mf-screen" data-screen-label="Голосование">
      <PhaseHead icon="Vote" title="День 2 — голосование" timer="0:37" />
      <div style={{ padding: '8px 20px 16px' }}>
        <div style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em' }}>Кто мафия?</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--mf-text-dim)', marginTop: 4 }}>Голос можно менять, пока идёт таймер</div>
      </div>

      <div className="mf-player-grid" style={{ flex: 1, alignContent: 'start' }}>
        {alive.map((p, i) => {
          const isMe = p.name === 'Кира';
          const n = counts[i] || 0;
          const mine = myVote === i;
          const leader = n === max && n > 0;
          return (
            <div key={p.name}
              className={'mf-player-card' + (mine ? ' picked' : '')}
              onClick={() => !isMe && setMyVote(mine ? null : i)}
              style={isMe ? { cursor: 'default', opacity: 0.7 } : leader && !mine ? { borderColor: 'rgba(225,29,72,0.45)' } : null}>
              <Avatar name={p.name} idx={p.idx} size={42} />
              <div className="mf-player-name">{p.name}{isMe ? ' (ты)' : ''}</div>
              {n > 0 ? (
                <div className="mf-mono" style={{
                  position: 'absolute', top: -10, right: 10,
                  background: leader ? 'var(--mf-crimson)' : 'var(--mf-surface-2)',
                  border: leader ? 'none' : '1px solid var(--mf-border)',
                  color: '#fff', borderRadius: 999, minWidth: 26, height: 26,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, padding: '0 8px',
                }}>{n}</div>
              ) : null}
              {mine ? (
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--mf-crimson)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <LIcon name="Check" size={13} />твой голос
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '14px 20px 18px' }}>
        <button className="mf-btn mf-btn-ghost" type="button" style={{ width: '100%' }}>Воздержаться</button>
      </div>
    </div>
  );
}

Object.assign(window, { VoteDay });
