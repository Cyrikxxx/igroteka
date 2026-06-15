// Общие компоненты зоны Мафии: иконки lucide, аватары, данные игроков
const { useState, useEffect, useRef } = React;

// --- Иконка из lucide UMD (window.lucide.icons, PascalCase) ---
function LIcon({ name, size = 22, strokeWidth = 2, style, color }) {
  const lu = window.lucide || {};
  let data = (lu.icons && lu.icons[name]) || lu[name] || null;
  if (!data) return <span style={{ width: size, height: size, display: 'inline-block' }}></span>;
  // данные могут быть ['svg', attrs, children] или сразу списком детей
  const children = Array.isArray(data) && data[0] === 'svg' ? data[2] : data;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color || 'currentColor'} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}>
      {children.map((c, i) => React.createElement(c[0], { key: i, ...c[1] }))}
    </svg>
  );
}

// --- Палитра аватаров (приглушённые тона) ---
const AVATAR_COLORS = ['#7f5af0', '#2cb1bc', '#d97706', '#5a8dee', '#c2557e', '#5fa052', '#9a6dd7', '#c97b4a', '#557fc2'];

function Avatar({ name, idx = 0, size = 44, dead = false }) {
  const bg = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: dead ? '#2a2a33' : bg,
      color: dead ? '#62636e' : 'rgba(255,255,255,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: size * 0.42, fontFamily: 'var(--font-main)',
      flexShrink: 0, userSelect: 'none',
    }}>{name[0]}</div>
  );
}

// --- Игроки демо-партии ---
const PLAYERS = [
  { name: 'Иван',  idx: 0 },
  { name: 'Кира',  idx: 1 },
  { name: 'Стас',  idx: 2 },
  { name: 'Маша',  idx: 3 },
  { name: 'Пётр',  idx: 4 },
  { name: 'Лена',  idx: 5 },
  { name: 'Артём', idx: 6 },
  { name: 'Оля',   idx: 7 },
  { name: 'Гоша',  idx: 8 },
];

// --- Роли ---
const ROLES = {
  mafia:    { label: 'Мафия',  icon: 'VenetianMask', color: 'var(--role-mafia)' },
  don:      { label: 'Дон',    icon: 'Crown',        color: 'var(--role-don)' },
  sheriff:  { label: 'Шериф',  icon: 'Search',       color: 'var(--role-sheriff)' },
  doctor:   { label: 'Доктор', icon: 'HeartPulse',   color: 'var(--role-doctor)' },
  maniac:   { label: 'Маньяк', icon: 'Skull',        color: 'var(--role-maniac)' },
  civilian: { label: 'Мирный', icon: 'User',         color: 'var(--role-civilian)' },
};

// --- Шапка фазы: название + таймер ---
function PhaseHead({ icon, title, timer, gold }) {
  return (
    <div className="mf-phase-head">
      <div className="mf-phase-title">
        <LIcon name={icon} size={22} color={gold ? 'var(--mf-gold)' : 'var(--mf-crimson)'} />
        <span>{title}</span>
      </div>
      {timer ? (
        <div className="mf-timer" style={{ fontSize: 22, color: 'var(--mf-text)' }}>{timer}</div>
      ) : null}
    </div>
  );
}

Object.assign(window, { LIcon, Avatar, AVATAR_COLORS, PLAYERS, ROLES, PhaseHead });
