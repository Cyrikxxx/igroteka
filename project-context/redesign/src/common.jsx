/* global React */
/* Shared atoms for the Alias redesign — Icon set (lucide), header, helpers */
const { useState, useEffect, useMemo, useRef } = React;

// ---- Lucide icon set (24x24, stroke) ----
const ICONS = {
  wifi: ["M12 20h.01", "M2 8.82a15 15 0 0 1 20 0", "M5 12.859a10 10 0 0 1 14 0", "M8.5 16.429a5 5 0 0 1 7 0"],
  smartphone: ["rect:5,2,14,20,2", "M12 18h.01"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "circle:9,7,4", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  user: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "circle:12,7,4"],
  clock: ["circle:12,12,10", "M12 6v6l4 2"],
  check: ["M20 6 9 17l-5-5"],
  x: ["M18 6 6 18", "M6 6l12 12"],
  play: ["M6 3l14 9-14 9z"],
  pause: ["rect:6,4,4,16,1", "rect:14,4,4,16,1"],
  trophy: ["M6 9H4.5a2.5 2.5 0 0 1 0-5H6", "M18 9h1.5a2.5 2.5 0 0 0 0-5H18", "M4 22h16", "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22", "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22", "M18 2H6v7a6 6 0 0 0 12 0V2Z"],
  crown: ["M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z", "M5 21h14"],
  plus: ["M5 12h14", "M12 5v14"],
  minus: ["M5 12h14"],
  arrowRight: ["M5 12h14", "M12 5l7 7-7 7"],
  arrowLeft: ["M19 12H5", "M12 19l-7-7 7-7"],
  settings: ["M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z", "circle:12,12,3"],
  refresh: ["M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", "M8 16H3v5"],
  qr: ["rect:3,3,5,5,1", "rect:16,3,5,5,1", "rect:3,16,5,5,1", "M21 16h-3a2 2 0 0 0-2 2v3", "M21 21v.01", "M12 7v3a2 2 0 0 1-2 2H7", "M3 12h.01", "M12 3h.01", "M12 16v.01", "M16 12h1", "M21 12v.01", "M12 21v-1"],
  sun: ["circle:12,12,4", "M12 2v2", "M12 20v2", "M4.93 4.93l1.41 1.41", "M17.66 17.66l1.41 1.41", "M2 12h2", "M20 12h2", "M6.34 17.66l-1.41 1.41", "M19.07 4.93l-1.41 1.41"],
  moon: ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"],
  copy: ["rect:9,9,13,13,2", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
  share: ["M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8", "M16 6l-4-4-4 4", "M12 2v13"],
  chevronRight: ["M9 18l6-6-6-6"],
  sparkles: ["M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z", "M20 3v4", "M22 5h-4", "M4 17v2", "M5 18H3"],
  hash: ["M4 9h16", "M4 15h16", "M10 3L8 21", "M16 3l-2 18"],
  dice: ["rect:3,3,18,18,2", "M8 8h.01", "M16 16h.01", "M12 12h.01", "M16 8h.01", "M8 16h.01"],
  link: ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  trash: ["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"],
  edit: ["M12 20h9", "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"],
  star: ["M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"],
  target: ["circle:12,12,10", "circle:12,12,6", "circle:12,12,2"],
  zap: ["M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 12 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 12 14z"],
  eyeOff: ["M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49", "M14.084 14.158a3 3 0 0 1-4.242-4.242", "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143", "M2 2l20 20"],
  message: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
  forward: ["M15 17l5-5-5-5", "M4 18v-2a4 4 0 0 1 4-4h12"],
  flag: ["M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z", "M4 22v-7"],
};

function Icon({ name, size, className, style, strokeWidth = 2 }) {
  const parts = ICONS[name] || [];
  return (
    <svg
      className={className}
      style={style}
      width={size || "1em"}
      height={size || "1em"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {parts.map((p, i) => {
        if (p.startsWith("circle:")) {
          const [cx, cy, r] = p.slice(7).split(",");
          return <circle key={i} cx={cx} cy={cy} r={r} />;
        }
        if (p.startsWith("rect:")) {
          const [x, y, w, h, rx] = p.slice(5).split(",");
          return <rect key={i} x={x} y={y} width={w} height={h} rx={rx || 0} />;
        }
        return <path key={i} d={p} />;
      })}
    </svg>
  );
}

// ---- Brand / header ----
function Brand({ onClick }) {
  return (
    <div className="brand" onClick={onClick}>
      <div className="brand-mark">
        <Icon name="sparkles" size={22} strokeWidth={2.2} />
      </div>
      <div className="brand-name">
        <b>alias<i>.online</i></b>
        <span>v2.0 · realtime party</span>
      </div>
    </div>
  );
}

function ThemeToggle({ theme, setTheme }) {
  return (
    <div className="seg" role="group" aria-label="Тема">
      <button className={theme === "dark" ? "on" : ""} onClick={() => setTheme("dark")} title="Тёмная">
        <Icon name="moon" />
      </button>
      <button className={theme === "light" ? "on" : ""} onClick={() => setTheme("light")} title="Светлая">
        <Icon name="sun" />
      </button>
    </div>
  );
}

function AppHeader({ theme, setTheme, onHome, right }) {
  return (
    <header className="app-header">
      <Brand onClick={onHome} />
      <div className="header-actions">
        {right}
        <ThemeToggle theme={theme} setTheme={setTheme} />
      </div>
    </header>
  );
}

// ---- Avatar ----
function Avatar({ name, team, size = 34, online }) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const bg = team ? `var(--team-${team})` : "var(--accent)";
  return (
    <span className={"avatar-wrap" + (online ? " avatar-online" : "")}>
      <span className="avatar" style={{ "--sz": size + "px", background: bg }}>{initials}</span>
    </span>
  );
}

// ---- Room code display ----
function RoomCode({ code, size }) {
  return (
    <div className={"code-chunk" + (size === "xl" ? " xl" : "")}>
      {code.split("").map((c, i) => <span key={i}>{c}</span>)}
    </div>
  );
}

// ---- Deterministic QR-ish svg (decorative but stable) ----
function QrCode({ value = "alias.online", cells = 21 }) {
  const grid = useMemo(() => {
    // simple deterministic hash fill + finder patterns
    let h = 0;
    for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
    const rng = () => {
      h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0;
      return h / 4294967296;
    };
    const m = Array.from({ length: cells }, () => Array(cells).fill(0));
    const finder = (r, c) => {
      for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
        const rr = r + i, cc = c + j;
        if (rr < 0 || cc < 0 || rr >= cells || cc >= cells) continue;
        const border = i === 0 || i === 6 || j === 0 || j === 6;
        const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        m[rr][cc] = (i >= 0 && i <= 6 && j >= 0 && j <= 6 && (border || core)) ? 1 : (i === -1 || i === 7 || j === -1 || j === 7) ? 0 : m[rr][cc];
      }
    };
    for (let r = 0; r < cells; r++) for (let c = 0; c < cells; c++) {
      if ((r < 8 && c < 8) || (r < 8 && c >= cells - 8) || (r >= cells - 8 && c < 8)) continue;
      m[r][c] = rng() > 0.55 ? 1 : 0;
    }
    finder(0, 0); finder(0, cells - 7); finder(cells - 7, 0);
    return m;
  }, [value, cells]);
  const s = 100 / cells;
  return (
    <svg viewBox="0 0 100 100">
      <rect width="100" height="100" fill="#fff" />
      {grid.map((row, r) =>
        row.map((v, c) => v ? <rect key={r + "-" + c} x={c * s} y={r * s} width={s * 1.02} height={s * 1.02} fill="#0a0d10" /> : null)
      )}
    </svg>
  );
}

// ---- Animated count-up number (timer-driven; resilient if rAF is throttled) ----
function useCountUp(target, dur = 700) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * e));
      if (p >= 1) clearInterval(id);
    }, 1000 / 30);
    return () => clearInterval(id);
  }, [target, dur]);
  return v;
}

// shared word categories (used by online create + offline settings)
const CATEGORIES = [
  { e: "🎬", n: "Кино", c: 84 }, { e: "🍔", n: "Еда", c: 71 }, { e: "🐾", n: "Животные", c: 63 },
  { e: "⚽", n: "Спорт", c: 58 }, { e: "🎵", n: "Музыка", c: 49 }, { e: "🌍", n: "География", c: 66 },
  { e: "💻", n: "Технологии", c: 52 }, { e: "🎨", n: "Искусство", c: 44 }, { e: "🧪", n: "Наука", c: 57 },
  { e: "😎", n: "Сленг", c: 85 },
];

Object.assign(window, { Icon, Brand, ThemeToggle, AppHeader, Avatar, RoomCode, QrCode, useCountUp, CATEGORIES });
