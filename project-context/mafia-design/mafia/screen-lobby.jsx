// Лобби комнаты Мафии — вид хоста (390×844)
function LobbyPlayerRow({ p, isHost, isSelf }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--mf-surface)', border: '1px solid var(--mf-border)',
      borderRadius: 16, padding: '10px 12px',
    }}>
      <div style={{ position: 'relative' }}>
        <Avatar name={p.name} idx={p.idx} size={40} />
        <div style={{
          position: 'absolute', right: -1, bottom: -1, width: 11, height: 11,
          borderRadius: '50%', background: p.online === false ? '#62636e' : '#34d399',
          border: '2px solid var(--mf-bg)',
        }}></div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 15.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}{isSelf ? ' (ты)' : ''}</span>
        {isHost ? <LIcon name="Crown" size={16} color="var(--mf-gold)" /> : null}
      </div>
      {!isHost ? (
        <button type="button" aria-label="Кикнуть" style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mf-text-faint)',
          display: 'flex', padding: 6,
        }}><LIcon name="X" size={17} /></button>
      ) : null}
    </div>
  );
}

function MafiaLobby({ few = false }) {
  const players = few ? PLAYERS.slice(0, 3) : PLAYERS.slice(0, 7);
  const count = players.length;
  return (
    <div className="mf-screen" data-screen-label={few ? 'Лобби — мало игроков' : 'Лобби'}>
      <div className="mf-phase-head">
        <div className="mf-phase-title">
          <LIcon name="DoorOpen" size={21} color="var(--mf-crimson)" />
          <span>Лобби</span>
        </div>
        <button type="button" style={{ background: 'none', border: 'none', color: 'var(--mf-text-faint)', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <LIcon name="LogOut" size={20} />
        </button>
      </div>

      {/* Код комнаты */}
      <div style={{ padding: '18px 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--mf-text-faint)', textTransform: 'uppercase' }}>Код комнаты</div>
        <div className="mf-mono" style={{ fontSize: 46, fontWeight: 700, letterSpacing: '0.22em', marginLeft: '0.22em', lineHeight: 1 }}>K7F2QD</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['Copy', 'Скопировать'], ['Share2', 'Поделиться'], ['QrCode', 'QR']].map(([ic, lbl]) => (
            <button key={ic} type="button" className="mf-chip" style={{ border: 'none', cursor: 'pointer', padding: '8px 14px', fontSize: 13, color: 'var(--mf-text)', fontFamily: 'var(--font-main)' }}>
              <LIcon name={ic} size={15} />{lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Игроки */}
      <div style={{ padding: '22px 20px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>Игроки</span>
          <span className="mf-mono" style={{ fontSize: 13.5, color: 'var(--mf-text-dim)', fontWeight: 700 }}>{count} / 16</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {players.map((p, i) => (
            <LobbyPlayerRow key={p.name} p={!few && i === 5 ? { ...p, online: false } : p} isHost={i === 0} isSelf={i === 0} />
          ))}
        </div>
      </div>

      {/* Предпросмотр состава + действия хоста */}
      <div style={{ padding: '12px 20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(225,29,72,0.07)',
          border: '1px solid rgba(225,29,72,0.25)', borderRadius: 14, padding: '11px 14px',
          fontSize: 13.5, fontWeight: 700, color: 'var(--mf-text-dim)', lineHeight: 1.4,
        }}>
          <LIcon name="VenetianMask" size={18} color="var(--mf-crimson)" />
          {few
            ? <span>3 игрока — состав появится от <b style={{ color: 'var(--mf-text)' }}>5 игроков</b></span>
            : <span>7 игроков → <b style={{ color: 'var(--mf-text)' }}>2 мафии (с Доном)</b> · Шериф · Доктор · 3 мирных</span>}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="mf-btn mf-btn-ghost" type="button" style={{ minWidth: 64, padding: '0 16px' }}>
            <LIcon name="Settings2" size={20} />
          </button>
          <button className="mf-btn mf-btn-crimson" type="button" disabled={few}
            style={{ flex: 1, opacity: few ? 0.4 : 1, cursor: few ? 'not-allowed' : 'pointer' }}>Начать игру</button>
        </div>
        {few ? (
          <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--mf-text-faint)' }}>Нужно минимум 5 игроков — ждём ещё 2</div>
        ) : null}
      </div>
    </div>
  );
}

Object.assign(window, { MafiaLobby, LobbyPlayerRow });
