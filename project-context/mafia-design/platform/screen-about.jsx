// Страница «О нас» — зачем, как работает, команда, планы, контакты, данные.
const ABOUT_HOW = [
  ['Smartphone', 'Один телефон', 'Локальная партия: телефон передаётся по кругу, интернет не нужен.'],
  ['Wifi', 'Комната по коду', 'Онлайн-партия: создаёшь комнату, друзья заходят по шестизначному коду.'],
  ['History', 'История партий', 'Незавершённая игра сохраняется — можно вернуться и доиграть позже.'],
];

const ABOUT_ROADMAP = [
  ['done', 'Алиас', 'Локальные и онлайн-партии, наборы слов', 'var(--al-green)'],
  ['done', 'Мафия', 'Онлайн-партии с ведущим и без', 'var(--mf-crimson)'],
  ['now', 'Общая история игр', 'Архив партий обеих игр в одном списке', 'var(--mf-gold)'],
  ['next', 'Новые игры', 'Игротека пополняется — следующая игра в работе', 'var(--role-civilian)'],
  ['next', 'Профили и статистика', 'Личный счёт побед и любимые наборы', 'var(--role-civilian)'],
];

const ABOUT_DATA = [
  ['UserX', 'Без регистрации', 'Аккаунт не нужен — достаточно имени в комнате.'],
  ['HardDrive', 'История на устройстве', 'Локальные партии хранятся в браузере и удаляются в один клик.'],
  ['EyeOff', 'Без рекламы и трекеров', 'Проект ничего не продаёт и не собирает лишних данных.'],
];

function AboutIntro({ desktop }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: desktop ? '1.15fr 1fr' : '1fr', gap: 14 }}>
      <InkCard style={{ gap: 14 }}>
        <SectionTitle desktop={desktop}>Зачем это сделано</SectionTitle>
        <p style={{ margin: 0, fontSize: 15.5, fontWeight: 600, color: 'var(--mf-text-dim)', lineHeight: 1.6, textWrap: 'pretty' }}>
          Настольные игры для компании обычно живут в трёх разных приложениях: одно для слов, другое для ролей,
          третье просто с таймером. Игротека собирает их в одном месте — с общим входом по коду, общей историей
          партий и одинаковыми правилами интерфейса.
        </p>
        <p style={{ margin: 0, fontSize: 15.5, fontWeight: 600, color: 'var(--mf-text-dim)', lineHeight: 1.6, textWrap: 'pretty' }}>
          Ничего не нужно устанавливать и регистрировать: открыл ссылку, назвал имя, начал играть.
        </p>
      </InkCard>
      <InkCard style={{ gap: 12, justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[['Бесплатно', 'var(--al-green)'], ['Без рекламы', 'var(--mf-text-dim)'], ['Без аккаунта', 'var(--mf-text-dim)']].map(([t, c]) => (
            <span key={t} className="mf-chip" style={{ color: c, fontSize: 13 }}>{t}</span>
          ))}
        </div>
        <div style={{ fontWeight: 800, fontSize: desktop ? 22 : 19, letterSpacing: '-0.01em', lineHeight: 1.3, textWrap: 'pretty' }}>
          Игры бесплатны целиком — платных наборов и подписки нет
        </div>
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--mf-text-faint)', lineHeight: 1.55, textWrap: 'pretty' }}>
          Поддержать проект можно донатом, но это по желанию: на доступные функции он не влияет.
        </p>
      </InkCard>
    </div>
  );
}

function AboutHow({ desktop }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionTitle desktop={desktop} note="ТРИ СПОСОБА СЫГРАТЬ">Как это работает</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(3, 1fr)' : '1fr', gap: 12 }}>
        {ABOUT_HOW.map(([icon, title, text], i) => (
          <InkCard key={title} style={{ gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <LIcon name={icon} size={20} color="var(--mf-text-dim)" />
              <span className="mf-mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mf-text-faint)' }}>0{i + 1}</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{title}</div>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--mf-text-dim)', lineHeight: 1.55, textWrap: 'pretty' }}>{text}</p>
          </InkCard>
        ))}
      </div>
    </div>
  );
}

function AboutTeam({ desktop }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionTitle desktop={desktop}>Кто делает</SectionTitle>
      <InkCard style={{ flexDirection: desktop ? 'row' : 'column', alignItems: desktop ? 'center' : 'flex-start', gap: 20 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
          border: '1.5px solid var(--ink-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--mf-text-dim)',
        }}>
          <LIcon name="User" size={28} strokeWidth={1.6} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Проект делает один человек</div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--mf-text-dim)', lineHeight: 1.55, maxWidth: 640, textWrap: 'pretty' }}>
            Дизайн, код, наборы слов и поддержка — всё в одних руках. Поэтому обновления выходят небольшими шагами,
            зато каждое письмо о баге или пожелании читает автор проекта.
          </p>
        </div>
      </InkCard>
    </div>
  );
}

function AboutRoadmap({ desktop }) {
  const marks = {
    done: ['Check', 'Готово'],
    now: ['Loader', 'В работе'],
    next: ['Circle', 'В планах'],
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionTitle desktop={desktop} note="БЕЗ ТОЧНЫХ ДАТ">Что дальше</SectionTitle>
      <InkCard style={{ padding: desktop ? '8px 20px' : '4px 16px', gap: 0 }}>
        {ABOUT_ROADMAP.map(([state, title, text, color], i) => {
          const [icon, label] = marks[state];
          return (
            <div key={title} style={{
              display: 'flex', alignItems: desktop ? 'center' : 'flex-start', gap: 14,
              padding: '16px 0', borderBottom: i < ABOUT_ROADMAP.length - 1 ? '1px solid var(--ink-border)' : 'none',
              flexDirection: desktop ? 'row' : 'column',
            }}>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 8, minWidth: 132,
                fontSize: 12.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                color: state === 'next' ? 'var(--mf-text-faint)' : color,
              }}>
                <LIcon name={icon} size={15} />{label}
              </span>
              <span style={{ fontWeight: 800, fontSize: 16, minWidth: desktop ? 220 : undefined, color: state === 'next' ? 'var(--mf-text-dim)' : 'var(--mf-text)' }}>{title}</span>
              <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--mf-text-faint)', lineHeight: 1.5, textWrap: 'pretty' }}>{text}</span>
            </div>
          );
        })}
      </InkCard>
    </div>
  );
}

function AboutContacts({ desktop }) {
  const items = [
    ['Send', 'Телеграм', 'Скоро', 'Канал с обновлениями и чат для вопросов'],
    ['Mail', 'Почта', 'Скоро', 'Для длинных писем: баги, идеи, сотрудничество'],
    ['Bug', 'Сообщить о баге', 'Форма в разработке', 'Что случилось, на каком экране, какая игра'],
    ['Heart', 'Поддержать донатом', 'Скоро', 'По желанию — на доступ к играм не влияет'],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionTitle desktop={desktop} note="ССЫЛКИ ПОЯВЯТСЯ ПОЗЖЕ">Связаться</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(2, 1fr)' : '1fr', gap: 12 }}>
        {items.map(([icon, title, badge, text]) => (
          <InkCard key={title} style={{ gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 16.5 }}>
                <LIcon name={icon} size={18} color="var(--mf-text-dim)" />{title}
              </span>
              <span className="mf-mono" style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: 'var(--mf-text-faint)', border: '1px dashed var(--ink-border)', borderRadius: 999, padding: '4px 10px',
              }}>{badge}</span>
            </div>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--mf-text-dim)', lineHeight: 1.5, textWrap: 'pretty' }}>{text}</p>
          </InkCard>
        ))}
      </div>
    </div>
  );
}

function AboutData({ desktop }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionTitle desktop={desktop}>Данные и приватность</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(3, 1fr)' : '1fr', gap: 12 }}>
        {ABOUT_DATA.map(([icon, title, text]) => (
          <InkCard key={title} style={{ gap: 8 }}>
            <LIcon name={icon} size={20} color="var(--mf-text-dim)" />
            <div style={{ fontWeight: 800, fontSize: 16.5 }}>{title}</div>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--mf-text-dim)', lineHeight: 1.5, textWrap: 'pretty' }}>{text}</p>
          </InkCard>
        ))}
      </div>
    </div>
  );
}

function AboutPage({ desktop }) {
  return (
    <PageShell desktop={desktop} active="О нас">
      <PageHead desktop={desktop} title="О проекте"
        lead="Игротека — площадка для игр в компании: Алиас и Мафия работают в браузере, без установки и регистрации. Дальше игр станет больше." />
      <AboutIntro desktop={desktop} />
      <AboutHow desktop={desktop} />
      <AboutTeam desktop={desktop} />
      <AboutRoadmap desktop={desktop} />
      <AboutContacts desktop={desktop} />
      <AboutData desktop={desktop} />
      <PageFooter desktop={desktop} />
    </PageShell>
  );
}

Object.assign(window, { AboutPage });
