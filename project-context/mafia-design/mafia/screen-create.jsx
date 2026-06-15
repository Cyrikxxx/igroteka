// Создание комнаты: шаг 1 (ник), шаг 2 (настройки), bottom sheet настроек в лобби
function CreateHeader({ step, title }) {
  return (
    <div className="mf-phase-head" style={{ paddingBottom: 4 }}>
      <div className="mf-phase-title">
        <LIcon name="ArrowLeft" size={20} color="var(--mf-text-faint)" />
        <span>{title}</span>
      </div>
      <span className="mf-mono" style={{ fontSize: 13, color: 'var(--mf-text-faint)', fontWeight: 700 }}>шаг {step} / 2</span>
    </div>
  );
}

function CreateStep1() {
  return (
    <div className="mf-screen" data-screen-label="Создание — ник">
      <CreateHeader step={1} title="Новая комната" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px', gap: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Как тебя зовут?</div>
        <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--mf-text-dim)' }}>Это имя увидят все игроки за столом</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, background: 'var(--mf-surface)',
          border: '1.5px solid var(--mf-crimson)', borderRadius: 'var(--r-btn)',
          padding: '15px 18px', boxShadow: '0 0 24px rgba(225,29,72,0.15)',
        }}>
          <Avatar name="Кира" idx={1} size={32} />
          <span style={{ fontWeight: 700, fontSize: 18 }}>Кира</span>
          <span style={{ width: 2, height: 22, background: 'var(--mf-crimson)', borderRadius: 2 }}></span>
        </div>
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <button className="mf-btn mf-btn-crimson" type="button" style={{ width: '100%' }}>
          Дальше<LIcon name="ArrowRight" size={19} />
        </button>
      </div>
    </div>
  );
}

// --- Переиспользуемый блок настроек (экран шага 2 и sheet хоста) ---
function SectionLabel({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--mf-text-faint)', margin: '20px 0 4px' }}>{children}</div>;
}

function TimerRow({ label, options, value }) {
  const [v, setV] = React.useState(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '11px 0', borderBottom: '1px solid var(--mf-border)' }}>
      <div className="mf-setting-label">{label}</div>
      <PresetChips options={options} value={v} onChange={setV} />
    </div>
  );
}

function RoomSettings() {
  const [mafiaMode, setMafiaMode] = React.useState('авто');
  const [mafiaN, setMafiaN] = React.useState(3);
  const [roles, setRoles] = React.useState({ don: true, sheriff: true, doctor: true, maniac: false });
  const [rules, setRules] = React.useState({ firstDay: true, reveal: true, openVotes: true, donHidden: false, spectators: true });
  const setRole = k => v => setRoles(s => ({ ...s, [k]: v }));
  const setRule = k => v => setRules(s => ({ ...s, [k]: v }));
  const seg = (on) => ({
    flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--font-main)', fontWeight: 700, fontSize: 14,
    background: on ? 'var(--mf-crimson)' : 'transparent', color: on ? '#fff' : 'var(--mf-text-dim)',
    transition: 'background 0.15s',
  });
  return (
    <div>
      <SectionLabel>Состав</SectionLabel>
      <div className="mf-setting-row">
        <div className="mf-setting-label">Мафия</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', background: 'var(--mf-surface-2)', borderRadius: 12, padding: 3, width: 170 }}>
            <button type="button" style={seg(mafiaMode === 'авто')} onClick={() => setMafiaMode('авто')}>Авто</button>
            <button type="button" style={seg(mafiaMode === 'вручную')} onClick={() => setMafiaMode('вручную')}>Вручную</button>
          </div>
          {mafiaMode === 'вручную' ? <Stepper value={mafiaN} onChange={setMafiaN} min={1} max={5} /> : null}
        </div>
      </div>
      <ToggleRow icon="Crown" iconColor="var(--mf-gold)" label="Дон" sub="Решающий голос мафии" on={roles.don} onChange={setRole('don')} />
      <ToggleRow icon="Search" iconColor="var(--role-sheriff)" label="Шериф" sub="Ночные проверки" on={roles.sheriff} onChange={setRole('sheriff')} />
      <ToggleRow icon="HeartPulse" iconColor="var(--role-doctor)" label="Доктор" sub="Лечит одного за ночь" on={roles.doctor} onChange={setRole('doctor')} />
      <ToggleRow icon="Skull" iconColor="var(--role-maniac)" label="Маньяк" sub="Третья сила, сам за себя" on={roles.maniac} onChange={setRole('maniac')} />
      <div style={{ marginTop: 14 }}>
        <CompBanner>9 игроков → <b style={{ color: 'var(--mf-text)' }}>3 мафии (с Доном)</b> · Шериф · Доктор · 4 мирных</CompBanner>
      </div>

      <SectionLabel>Таймеры</SectionLabel>
      <TimerRow label="Ночь" options={['30 с', '60 с', '90 с']} value="60 с" />
      <TimerRow label="Обсуждение" options={['1 мин', '2 мин', '3 мин', '5 мин']} value="2 мин" />
      <TimerRow label="Голосование" options={['30 с', '45 с', '60 с']} value="45 с" />
      <TimerRow label="Последнее слово" options={['15 с', '30 с', '45 с']} value="30 с" />

      <SectionLabel>Правила</SectionLabel>
      <ToggleRow label="Первый день без голосования" on={rules.firstDay} onChange={setRule('firstDay')} />
      <ToggleRow label="Раскрывать роль погибших" on={rules.reveal} onChange={setRule('reveal')} />
      <ToggleRow label="Голоса видны при голосовании" on={rules.openVotes} onChange={setRule('openVotes')} />
      <ToggleRow label="Дон скрыт от шерифа" on={rules.donHidden} onChange={setRule('donHidden')} />
      <ToggleRow label="Зрители видят роли" on={rules.spectators} onChange={setRule('spectators')} />
    </div>
  );
}

function CreateStep2() {
  return (
    <div className="mf-screen" data-screen-label="Создание — настройки" style={{ height: 'auto', minHeight: '100%', overflow: 'visible' }}>
      <CreateHeader step={2} title="Настройки игры" />
      <div style={{ padding: '0 20px', flex: 1 }}>
        <RoomSettings />
      </div>
      <div style={{ padding: '18px 20px 20px' }}>
        <button className="mf-btn mf-btn-crimson" type="button" style={{ width: '100%' }}>Создать комнату</button>
      </div>
    </div>
  );
}

// Bottom sheet настроек поверх лобби
function LobbySettingsSheet() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }} data-screen-label="Лобби — настройки (sheet)">
      <div style={{ position: 'absolute', inset: 0, filter: 'brightness(0.45)', pointerEvents: 'none' }}>
        <MafiaLobby />
      </div>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, top: 110,
        background: 'var(--mf-surface)', borderRadius: '24px 24px 0 0',
        border: '1px solid var(--mf-border)', borderBottom: 'none',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 -16px 48px rgba(0,0,0,0.6)',
        fontFamily: 'var(--font-main)', color: 'var(--mf-text)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }}></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 0' }}>
          <span style={{ fontWeight: 800, fontSize: 19 }}>Настройки игры</span>
          <LIcon name="X" size={20} color="var(--mf-text-faint)" />
        </div>
        <div style={{ flex: 1, overflow: 'hidden', padding: '0 20px', maskImage: 'linear-gradient(to bottom, black 86%, transparent)' }}>
          <RoomSettings />
        </div>
        <div style={{ padding: '12px 20px 18px' }}>
          <button className="mf-btn mf-btn-crimson" type="button" style={{ width: '100%' }}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}

// --- Вход по коду ---
function JoinByCode() {
  return (
    <div className="mf-screen" data-screen-label="Вход по коду">
      <div className="mf-phase-head" style={{ paddingBottom: 4 }}>
        <div className="mf-phase-title">
          <LIcon name="ArrowLeft" size={20} color="var(--mf-text-faint)" />
          <span>Вход в комнату</span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px', gap: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--mf-text-faint)' }}>Код комнаты</div>
          <div className="mf-mono" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--mf-surface)', border: '1.5px solid var(--mf-crimson)',
            borderRadius: 'var(--r-btn)', padding: '16px 18px',
            fontSize: 30, fontWeight: 700, letterSpacing: '0.3em', marginLeft: 0,
            boxShadow: '0 0 24px rgba(225,29,72,0.15)',
          }}>K7F2<span style={{ color: 'var(--mf-text-faint)' }}>__</span></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--mf-text-faint)' }}>Как тебя зовут?</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, background: 'var(--mf-surface)',
            border: '1.5px solid var(--mf-border)', borderRadius: 'var(--r-btn)', padding: '14px 18px',
          }}>
            <Avatar name="Маша" idx={3} size={30} />
            <span style={{ fontWeight: 700, fontSize: 17 }}>Маша</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <button className="mf-btn mf-btn-crimson" type="button" style={{ width: '100%' }}>
          Войти в комнату<LIcon name="ArrowRight" size={19} />
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { CreateStep1, CreateStep2, RoomSettings, LobbySettingsSheet, JoinByCode });
