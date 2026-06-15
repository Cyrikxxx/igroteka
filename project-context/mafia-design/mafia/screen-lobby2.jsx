// Лобби: десктопная версия (хост) и вид игрока (моб.)
function LobbyShareButtons({ big }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {[['Copy', 'Скопировать'], ['Share2', 'Поделиться']].map(([ic, lbl]) => (
        <button key={ic} type="button" className="mf-chip" style={{
          border: 'none', cursor: 'pointer', padding: big ? '10px 18px' : '8px 14px',
          fontSize: big ? 14 : 13, color: 'var(--mf-text)', fontFamily: 'var(--font-main)',
        }}>
          <LIcon name={ic} size={big ? 16 : 15} />{lbl}
        </button>
      ))}
    </div>
  );
}

function QrPlaceholder({ size = 180 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 18,
      background: 'repeating-linear-gradient(45deg, #15151f 0px, #15151f 8px, #121219 8px, #121219 16px)',
      border: '1px solid var(--mf-border)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--mf-text-faint)',
    }}>
      <LIcon name="QrCode" size={52} strokeWidth={1.2} />
      <span className="mf-mono" style={{ fontSize: 11 }}>QR-код комнаты</span>
    </div>
  );
}

function MafiaLobbyDesktop() {
  const seven = PLAYERS.slice(0, 7);
  return (
    <div className="mf-screen" data-screen-label="Лобби — десктоп">
      <div className="mf-phase-head" style={{ padding: '22px 40px 0' }}>
        <div className="mf-phase-title">
          <LIcon name="DoorOpen" size={21} color="var(--mf-crimson)" />
          <span>Лобби</span>
        </div>
        <button type="button" style={{ background: 'none', border: 'none', color: 'var(--mf-text-faint)', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <LIcon name="LogOut" size={20} />
        </button>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 48, padding: '28px 64px 32px', minHeight: 0 }}>
        {/* Левая колонка: код + шаринг + QR */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--mf-text-faint)', textTransform: 'uppercase' }}>Код комнаты</div>
          <div className="mf-mono" style={{ fontSize: 72, fontWeight: 700, letterSpacing: '0.18em', marginLeft: '0.18em', lineHeight: 1 }}>K7F2QD</div>
          <LobbyShareButtons big />
          <QrPlaceholder />
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--mf-text-faint)', textAlign: 'center' }}>Наведи камеру телефона,<br />чтобы войти в комнату</div>
        </div>
        {/* Правая колонка: игроки + состав + старт */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 800, fontSize: 17 }}>Игроки</span>
            <span className="mf-mono" style={{ fontSize: 14, color: 'var(--mf-text-dim)', fontWeight: 700 }}>7 / 16</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
            {seven.map((p, i) => (
              <LobbyPlayerRow key={p.name} p={i === 5 ? { ...p, online: false } : p} isHost={i === 0} isSelf={i === 0} />
            ))}
          </div>
          <CompBanner>7 игроков → <b style={{ color: 'var(--mf-text)' }}>2 мафии (с Доном)</b> · Шериф · Доктор · 3 мирных</CompBanner>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="mf-btn mf-btn-ghost" type="button" style={{ minWidth: 64, padding: '0 16px' }}>
              <LIcon name="Settings2" size={20} />
            </button>
            <button className="mf-btn mf-btn-crimson" type="button" style={{ flex: 1 }}>Начать игру</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Вид обычного игрока: без киков, без старта
function MafiaLobbyPlayer() {
  const seven = PLAYERS.slice(0, 7);
  return (
    <div className="mf-screen" data-screen-label="Лобби — вид игрока">
      <div className="mf-phase-head">
        <div className="mf-phase-title">
          <LIcon name="DoorOpen" size={21} color="var(--mf-crimson)" />
          <span>Лобби</span>
        </div>
        <button type="button" style={{ background: 'none', border: 'none', color: 'var(--mf-text-faint)', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <LIcon name="LogOut" size={20} />
        </button>
      </div>
      <div style={{ padding: '18px 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--mf-text-faint)', textTransform: 'uppercase' }}>Код комнаты</div>
        <div className="mf-mono" style={{ fontSize: 46, fontWeight: 700, letterSpacing: '0.22em', marginLeft: '0.22em', lineHeight: 1 }}>K7F2QD</div>
        <LobbyShareButtons />
      </div>
      <div style={{ padding: '22px 20px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>Игроки</span>
          <span className="mf-mono" style={{ fontSize: 13.5, color: 'var(--mf-text-dim)', fontWeight: 700 }}>7 / 16</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {seven.map((p, i) => (
            <div key={p.name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--mf-surface)', border: '1px solid var(--mf-border)',
              borderRadius: 16, padding: '10px 12px',
            }}>
              <div style={{ position: 'relative' }}>
                <Avatar name={p.name} idx={p.idx} size={40} />
                <div style={{
                  position: 'absolute', right: -1, bottom: -1, width: 11, height: 11,
                  borderRadius: '50%', background: i === 5 ? '#62636e' : '#34d399',
                  border: '2px solid var(--mf-bg)',
                }}></div>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontWeight: 700, fontSize: 15.5 }}>{p.name}{i === 1 ? ' (ты)' : ''}</span>
                {i === 0 ? <LIcon name="Crown" size={16} color="var(--mf-gold)" /> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      <StatusBar icon="Hourglass" iconColor="var(--mf-crimson)">Ждём начала… Хост настраивает игру</StatusBar>
    </div>
  );
}

Object.assign(window, { MafiaLobbyDesktop, MafiaLobbyPlayer, QrPlaceholder });
