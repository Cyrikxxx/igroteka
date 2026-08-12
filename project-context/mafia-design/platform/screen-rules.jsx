// Страница «Правила» — табы Алиас / Мафия: шаги, роли, спорные моменты.
const RULES_ALIAS = {
  accent: 'var(--al-green)',
  lead: 'Одна команда объясняет слова, другая угадывает. Побеждает команда, первой набравшая нужное число очков.',
  facts: [['Игроков', '4–24'], ['Команд', '2–6'], ['Раунд', '60 сек'], ['Цель', '50 очков']],
  steps: [
    ['Соберите команды', 'Разделитесь поровну, минимум по два человека. Название команды можно поменять перед стартом.'],
    ['Выберите набор слов', 'Классика, Для своих, Детский, Кино, Профессии или Хардкор. Наборы можно комбинировать.'],
    ['Объясняйте на время', 'Ведущий объясняет слово любыми словами, кроме однокоренных и перевода. Команда называет варианты вслух.'],
    ['Считайте очки', 'Угаданное слово — плюс очко, пропуск — минус очко. Ход переходит к следующей команде.'],
    ['Доведите до цели', 'Партия заканчивается, когда команда набирает цель по очкам. Все команды доигрывают круг до конца.'],
  ],
  roles: [
    ['MessageSquareText', 'Объясняющий', 'var(--al-green)', 'Говорит про слово всё, кроме однокоренных, перевода и первой буквы.'],
    ['Users2', 'Команда', 'var(--al-lime)', 'Называет варианты вслух, без ограничений по числу попыток.'],
    ['Eye', 'Соперники', 'var(--mf-text-dim)', 'Следят за нарушениями и отменяют спорное слово большинством.'],
  ],
  disputes: [
    ['Однокоренные слова', 'Слово не засчитывается, ход продолжается. Штрафа сверх этого нет.'],
    ['Слово угадали после сигнала', 'Засчитывается, если объяснение началось до конца таймера.'],
    ['Жесты и звуки', 'По умолчанию запрещены. Разрешить можно, но договоритесь до начала партии.'],
    ['Пропуск слова', 'Стоит минус очко. Число пропусков за раунд не ограничено.'],
    ['Ничья по очкам', 'Играется дополнительный раунд для команд с равным счётом.'],
  ],
};

const RULES_MAFIA = {
  accent: 'var(--mf-crimson)',
  lead: 'Город спит — мафия убивает. Днём город обсуждает и голосует. Побеждает сторона, оставшаяся в большинстве.',
  facts: [['Игроков', '5–16'], ['Мафия', '1 на 3–4 игрока'], ['Ночь', '30 сек'], ['День', '3–5 мин']],
  steps: [
    ['Раздайте роли', 'Роли приходят на телефоны игроков и видны только владельцу. Ведущий не обязателен.'],
    ['Ночь', 'Мафия выбирает жертву, шериф проверяет одного игрока, доктор лечит. Всё вслепую, через экран.'],
    ['Утро', 'Город узнаёт, кто выбыл ночью. Роль выбывшего показывается по настройке партии.'],
    ['Обсуждение', 'Каждый говорит по очереди: версии, подозрения, оправдания. Таймер общий на день.'],
    ['Голосование', 'Город выбирает, кого выгнать. Игра идёт до победы одной из сторон.'],
  ],
  roles: [
    ['VenetianMask', 'Мафия', 'var(--role-mafia)', 'Ночью выбирает жертву, днём притворяется мирным.'],
    ['Crown', 'Дон', 'var(--mf-gold)', 'Глава мафии: его голос решает при споре внутри команды.'],
    ['Search', 'Шериф', 'var(--role-sheriff)', 'Каждую ночь проверяет одного игрока: мафия или нет.'],
    ['HeartPulse', 'Доктор', 'var(--role-doctor)', 'Спасает одного игрока за ночь, себя — не чаще раза за партию.'],
    ['Skull', 'Маньяк', 'var(--role-maniac)', 'Играет сам за себя и убивает по одному каждую ночь.'],
    ['User', 'Мирный житель', 'var(--role-civilian)', 'Ничего не умеет ночью, всё решает голосом днём.'],
  ],
  disputes: [
    ['Равное число голосов', 'Игроки с равным счётом говорят по 30 секунд, затем переголосование. Второе равенство — никто не выбывает.'],
    ['Мафия убивает своего', 'Разрешено: ход засчитывается как обычное убийство.'],
    ['Доктор вылечил жертву', 'Ночь проходит без выбывших, город не узнаёт, кого спасали.'],
    ['Игрок раскрыл роль', 'Раскрывать роль словами можно, доказывать — нечем: приложение подсказок не даёт.'],
    ['Выбывший подсказывает', 'После выбывания чат закрыт. Подсказки живым считаются нарушением.'],
  ],
};

function RulesTabs({ value, onChange }) {
  const items = [['alias', 'Алиас', 'var(--al-green)', 'Sparkles'], ['mafia', 'Мафия', 'var(--mf-crimson)', 'VenetianMask']];
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {items.map(([k, label, color, icon]) => {
        const on = value === k;
        return (
          <button key={k} type="button" onClick={() => onChange(k)} style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            fontFamily: 'var(--font-main)', fontWeight: 800, fontSize: 15,
            padding: '11px 20px', borderRadius: 999,
            background: on ? `color-mix(in srgb, ${color} 14%, transparent)` : 'transparent',
            border: `1px solid ${on ? `color-mix(in srgb, ${color} 45%, transparent)` : 'var(--ink-border)'}`,
            color: on ? color : 'var(--mf-text-faint)',
          }}>
            <LIcon name={icon} size={16} />{label}
          </button>
        );
      })}
    </div>
  );
}

function RulesFacts({ data, desktop }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)', gap: 12 }}>
      {data.facts.map(([label, value]) => (
        <InkCard key={label} style={{ gap: 5, padding: desktop ? '18px 20px' : '14px 16px' }}>
          <div className="mf-mono" style={{ fontWeight: 700, fontSize: desktop ? 24 : 20, color: data.accent, lineHeight: 1.1 }}>{value}</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mf-text-faint)' }}>{label}</div>
        </InkCard>
      ))}
    </div>
  );
}

function RulesSteps({ data, desktop }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionTitle desktop={desktop} note="ПОРЯДОК ПАРТИИ">Как играть</SectionTitle>
      <InkCard style={{ padding: desktop ? '6px 22px' : '4px 16px', gap: 0 }}>
        {data.steps.map(([title, text], i) => (
          <div key={title} style={{
            display: 'flex', gap: 16, padding: '18px 0', alignItems: 'flex-start',
            borderBottom: i < data.steps.length - 1 ? '1px solid var(--ink-border)' : 'none',
          }}>
            <span className="mf-mono" style={{ fontSize: 14, fontWeight: 700, color: data.accent, paddingTop: 2, minWidth: 24 }}>0{i + 1}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontWeight: 800, fontSize: 16.5 }}>{title}</div>
              <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--mf-text-dim)', lineHeight: 1.55, textWrap: 'pretty' }}>{text}</p>
            </div>
          </div>
        ))}
      </InkCard>
    </div>
  );
}

function RulesRoles({ data, desktop, title }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionTitle desktop={desktop}>{title}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(3, 1fr)' : '1fr', gap: 12 }}>
        {data.roles.map(([icon, name, color, text]) => (
          <InkCard key={name} style={{ gap: 9 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `color-mix(in srgb, ${color} 12%, transparent)`, color,
            }}>
              <LIcon name={icon} size={20} strokeWidth={1.8} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 16.5, color }}>{name}</div>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--mf-text-dim)', lineHeight: 1.5, textWrap: 'pretty' }}>{text}</p>
          </InkCard>
        ))}
      </div>
    </div>
  );
}

function RulesDisputes({ data, desktop }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionTitle desktop={desktop} note="ЧАСТЫЕ СПОРЫ">Спорные моменты</SectionTitle>
      <InkCard style={{ padding: desktop ? '6px 22px' : '4px 16px', gap: 0 }}>
        {data.disputes.map(([q, a], i) => (
          <div key={q} style={{
            display: 'flex', gap: desktop ? 24 : 10, padding: '16px 0',
            flexDirection: desktop ? 'row' : 'column',
            borderBottom: i < data.disputes.length - 1 ? '1px solid var(--ink-border)' : 'none',
          }}>
            <div style={{ fontWeight: 800, fontSize: 15.5, minWidth: desktop ? 280 : undefined, flexShrink: 0 }}>{q}</div>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--mf-text-dim)', lineHeight: 1.55, textWrap: 'pretty' }}>{a}</p>
          </div>
        ))}
      </InkCard>
    </div>
  );
}

function RulesPage({ desktop, initial }) {
  const [tab, setTab] = React.useState(initial || 'alias');
  const data = tab === 'alias' ? RULES_ALIAS : RULES_MAFIA;
  return (
    <PageShell desktop={desktop} active="Правила">
      <PageHead desktop={desktop} title="Правила" lead={data.lead} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: desktop ? 22 : 18 }}>
        <RulesTabs value={tab} onChange={setTab} />
        <RulesFacts data={data} desktop={desktop} />
      </div>
      <RulesSteps data={data} desktop={desktop} />
      <RulesRoles data={data} desktop={desktop} title={tab === 'alias' ? 'Кто что делает' : 'Роли'} />
      <RulesDisputes data={data} desktop={desktop} />
      <PageFooter desktop={desktop} />
    </PageShell>
  );
}

Object.assign(window, { RulesPage });
