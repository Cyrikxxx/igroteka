/* global React, Icon, Avatar, useCountUp */
const { useState: useStateGame, useEffect: useEffectGame, useRef: useRefGame } = React;

const WORDS = ["Титаник", "Маяк", "Бумеранг", "Гравитация", "Карнавал", "Шахматы", "Космонавт", "Лабиринт", "Вулкан", "Телескоп"];

function fmt(t) {
  const m = Math.floor(t / 60), s = t % 60;
  return m + ":" + String(s).padStart(2, "0");
}

// ============ GAME · timer ring ============
function TimerRing({ value, total, danger }) {
  const S = 200;
  const r = S / 2 - 9;
  const circ = 2 * Math.PI * r;
  const pct = value / total;
  const col = danger ? "var(--danger)" : "var(--accent)";
  return (
    <div className={"timer-ring game-timer" + (danger ? " danger" : "")}>
      <svg viewBox={"0 0 " + S + " " + S} width="100%" height="100%">
        <circle cx={S / 2} cy={S / 2} r={r} stroke="var(--bg-3)" strokeWidth="9" fill="none" />
        <circle
          cx={S / 2} cy={S / 2} r={r} stroke={col} strokeWidth="9" fill="none"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1s linear, stroke .3s" }}
        />
      </svg>
      <span className="t-val">{fmt(value)}</span>
    </div>
  );
}

// ============ PRE_ROUND countdown ============
function Countdown({ onDone }) {
  const [n, setN] = useStateGame(3);
  useEffectGame(() => {
    if (n <= 0) { const id = setTimeout(onDone, 650); return () => clearTimeout(id); }
    const id = setTimeout(() => setN((x) => x - 1), 900);
    return () => clearTimeout(id);
  }, [n]);
  return (
    <div className="countdown-overlay">
      <span className="eyebrow">раунд начинается</span>
      <div className="cd-num mono" key={n}>{n > 0 ? n : "GO"}</div>
      <p className="muted">{n > 0 ? "Приготовься объяснять…" : "Поехали!"}</p>
    </div>
  );
}

// ============ GAME SCREEN ============
function GameScreen({ go, role }) {
  const TOTAL = 60;
  const explainer = role === "explainer";
  const spectator = role === "spectator";
  const [phase, setPhase] = useStateGame("pre"); // pre | active
  const [time, setTime] = useStateGame(42);
  const [running, setRunning] = useStateGame(true);
  const [wi, setWi] = useStateGame(0);
  const [got, setGot] = useStateGame(7);
  const [skip, setSkip] = useStateGame(2);
  const [paused, setPaused] = useStateGame(false);
  const [flash, setFlash] = useStateGame(null);

  useEffectGame(() => {
    if (phase !== "active" || !running || paused) return;
    if (time <= 0) { setRunning(false); go("roundSummary"); return; }
    const id = setTimeout(() => setTime((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [time, running, paused, phase]);

  const next = (type) => {
    setFlash(type);
    setTimeout(() => setFlash(null), 280);
    if (type === "got") setGot((g) => g + 1); else setSkip((s) => s + 1);
    setWi((i) => (i + 1) % WORDS.length);
  };

  const danger = phase === "active" && time <= 10;

  return (
    <div className={"screen game-screen screen-anim" + (danger ? " danger" : "")}>
      <div className="game-bg" />
      <div className="shell game-shell">
        {/* top bar */}
        <div className="game-top">
          <button className="back-link" onClick={() => go("home")}><Icon name="logout" /> Выйти</button>
          <div className="game-turn">
            <Avatar name="Макс" team={1} size={34} online={!explainer} />
            <div>
              <span className="gt-name">
                {explainer ? "Твой ход" : "Макс объясняет"}
              </span>
              <span className="gt-team mono">
                {spectator ? "наблюдаешь · команда «Мятные»" : "Команда «Мятные»"}
              </span>
            </div>
          </div>
          {explainer
            ? <button className="icon-btn" onClick={() => setPaused(true)}><Icon name="pause" /></button>
            : <span className={"pill " + (spectator ? "pill-mono" : "pill-accent pill-mono")}>
                {spectator ? <><Icon name="eyeOff" size={13} /> зритель</> : <><Icon name="users" size={13} /> угадываешь</>}
              </span>}
        </div>

        {/* center */}
        <div className="game-center">
          <TimerRing value={time} total={TOTAL} danger={danger} />

          {explainer ? (
            <div className={"word-card-big" + (flash ? " flash-" + flash : "")}>
              <span className="word-eyebrow"><Icon name="eyeOff" size={13} /> видишь только ты · кино</span>
              <strong className="word-main">{WORDS[wi]}</strong>
              <span className="word-index mono">слово {got + skip + 1}</span>
            </div>
          ) : (
            <div className="guesser-card">
              <div className={"guesser-pulse" + (spectator ? " spectate" : "")}>
                <Icon name={spectator ? "eyeOff" : "message"} size={30} />
              </div>
              <span className="guesser-hidden mono"><Icon name="eyeOff" size={14} /> слово скрыто</span>
              <p className="muted" style={{ margin: 0 }}>
                {spectator
                  ? "Ты наблюдаешь за раундом. Макс объясняет своей команде — слово видит только он."
                  : "Слушай и выкрикивай слово вслух — очко засчитает объясняющий."}
              </p>
              <span className="word-index mono">слово {got + skip + 1}</span>
            </div>
          )}

          <div className={"game-counts" + (explainer ? "" : " game-counts--big")}>
            <div className="gc gc-got"><Icon name="check" /> {got} <span>угадано</span></div>
            <div className="gc gc-skip"><Icon name="forward" /> {skip} <span>пропуск</span></div>
          </div>
        </div>

        {/* actions */}
        {explainer ? (
          <div className="game-actions">
            <button className="game-btn skip" onClick={() => next("skip")}>
              <Icon name="forward" size={24} /> Пропустил
            </button>
            <button className="game-btn got" onClick={() => next("got")}>
              <Icon name="check" size={26} /> Угадал
            </button>
          </div>
        ) : (
          <div className="guesser-foot">
            <span className="pill pill-mono"><Icon name="clock" size={14} /> ход переходит по таймеру</span>
            {!spectator && <button className="btn btn-secondary btn-sm" onClick={() => setPaused(true)}><Icon name="flag" size={15} /> Спор по слову</button>}
          </div>
        )}
      </div>

      {/* PRE_ROUND countdown */}
      {phase === "pre" && <Countdown onDone={() => setPhase("active")} />}

      {/* pause overlay */}
      {paused && (
        <div className="pause-overlay">
          <div className="pause-card card screen-anim">
            <Icon name="pause" size={40} className="accent-text" />
            <h2 className="h-display">Пауза</h2>
            <p className="h-sub">Таймер заморожен на <b className="mono">{fmt(time)}</b>. Можно продолжить или завершить раунд.</p>
            <div className="pause-actions">
              <button className="btn btn-secondary" onClick={() => go("home")}><Icon name="logout" /> Завершить</button>
              <button className="btn btn-primary btn-lg" onClick={() => setPaused(false)}><Icon name="play" /> Продолжить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ ROUND SUMMARY ============
function RoundSummary({ go }) {
  const [words, setWords] = useStateGame([
    { w: "Титаник", got: true }, { w: "Маяк", got: true }, { w: "Бумеранг", got: false },
    { w: "Гравитация", got: true }, { w: "Карнавал", got: true }, { w: "Шахматы", got: false },
    { w: "Космонавт", got: true }, { w: "Лабиринт", got: true }, { w: "Вулкан", got: true },
  ]);
  const toggle = (i) => setWords(words.map((x, j) => (j === i ? { ...x, got: !x.got } : x)));
  const score = words.reduce((s, x) => s + (x.got ? 1 : -1), 0);
  const gotN = words.filter((x) => x.got).length;

  return (
    <div className="screen center-screen screen-anim">
      <div className="shell">
        <div className="summary-wrap">
          <div className="summary-left">
            <span className="eyebrow">итог раунда · команда «мятные»</span>
            <h1 className="h-display" style={{ margin: "12px 0" }}>Отличный раунд!</h1>
            <p className="h-sub">Проверь слова — тапни, чтобы переключить «угадано / пропуск», если где-то ошиблись.</p>

            <div className="round-score">
              <div className="rs-big">
                <span className="rs-plus accent-text mono">+{score}</span>
                <span className="rs-l">очков за раунд</span>
              </div>
              <div className="rs-split">
                <div><b className="mono accent-text">{gotN}</b> угадано</div>
                <div><b className="mono">{words.length - gotN}</b> пропуск</div>
                <div><b className="mono">25</b> общий счёт</div>
              </div>
            </div>

            <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 4 }} onClick={() => go("victory")}>
              Дальше · следующий ход <Icon name="arrowRight" />
            </button>
          </div>

          <div className="card summary-words">
            <div className="row-between" style={{ marginBottom: 14 }}>
              <h2 className="h-title">Слова раунда</h2>
              <span className="pill pill-mono">{words.length} слов</span>
            </div>
            <div className="words-list">
              {words.map((x, i) => (
                <div key={i} className={"word-row " + (x.got ? "got" : "skip")} onClick={() => toggle(i)}>
                  <span className="wr-ic"><Icon name={x.got ? "check" : "x"} size={15} /></span>
                  {x.w}
                  <span className="wr-pts">{x.got ? "+1" : "−1"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ VICTORY ============
const FINAL = [
  { id: 1, name: "Мятные", score: 52, players: ["Макс", "Аня", "Игорь"] },
  { id: 3, name: "Лиловые", score: 44, players: ["Соня", "Паша", "Кира"] },
  { id: 2, name: "Янтарные", score: 38, players: ["Лена", "Дима"] },
];

function Victory({ go }) {
  const win = FINAL[0];
  const winScore = useCountUp(win.score, 900);
  const podium = [FINAL[1], FINAL[0], FINAL[2]]; // 2nd, 1st, 3rd
  const heights = { 0: "clamp(96px, 17vh, 150px)", 1: "clamp(150px, 26vh, 220px)", 2: "clamp(74px, 13vh, 116px)" };
  const places = { [FINAL[0].id]: 1, [FINAL[1].id]: 2, [FINAL[2].id]: 3 };

  return (
    <div className="screen center-screen screen-anim">
      <div className="shell">
        <div className="victory-wrap">
          <div className="victory-head">
            <span className="eyebrow">партия завершена</span>
            <div className="victory-trophy" style={{ "--tc": `var(--team-${win.id})` }}>
              <Icon name="trophy" size={48} />
            </div>
            <h1 className="h-mega victory-title" style={{ color: `var(--team-${win.id})` }}>{win.name}</h1>
            <p className="h-sub">Победа со счётом <b className="mono">{winScore}</b> очков. Достойно!</p>
          </div>

          <div className="podium">
            {podium.map((t) => {
              const place = places[t.id];
              return (
                <div className={"podium-col p" + place} key={t.id} style={{ "--tc": `var(--team-${t.id})` }}>
                  <div className="podium-team">
                    {place === 1 && <Icon name="crown" size={26} className="podium-crown" />}
                    <Avatar name={t.name} team={t.id} size={44} />
                    <b>{t.name}</b>
                    <span className="podium-score mono">{t.score}</span>
                  </div>
                  <div className="podium-bar" style={{ height: heights[podium.indexOf(t)] }}>
                    <span className="podium-place mono">{place}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="victory-table card">
            {FINAL.map((t, i) => (
              <div className="vt-row" key={t.id} style={{ "--tc": `var(--team-${t.id})` }}>
                <span className="vt-rank mono">{i + 1}</span>
                <span className="vt-dot" />
                <span className="vt-name">{t.name}</span>
                <span className="vt-players muted">{t.players.join(", ")}</span>
                <span className="vt-score mono">{t.score}</span>
              </div>
            ))}
          </div>

          <div className="victory-actions">
            <button className="btn btn-secondary btn-lg" onClick={() => go("home")}><Icon name="arrowLeft" /> На главную</button>
            <button className="btn btn-primary btn-lg" onClick={() => go("teams")}><Icon name="refresh" /> Реванш</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { GameScreen, RoundSummary, Victory, TimerRing });
