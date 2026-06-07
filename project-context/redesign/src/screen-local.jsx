/* global React, Icon, Avatar */
const { useState: useStateLocal } = React;

const TEAM_NAMES = ["Мятные", "Янтарные", "Лиловые", "Небесные", "Алые", "Лаймовые"];

// ============ STEP 1 · TEAMS ============
function TeamsScreen({ go }) {
  const [teams, setTeams] = useStateLocal([
    { id: 1, name: "Мятные", players: ["Макс", "Аня", "Игорь"] },
    { id: 2, name: "Янтарные", players: ["Лена", "Дима"] },
    { id: 3, name: "Лиловые", players: ["Соня", "Паша"] },
  ]);
  const [draft, setDraft] = useStateLocal({});

  const total = teams.reduce((s, t) => s + t.players.length, 0);

  const addPlayer = (id) => {
    const v = (draft[id] || "").trim();
    if (!v) return;
    setTeams(teams.map((t) => (t.id === id ? { ...t, players: [...t.players, v] } : t)));
    setDraft({ ...draft, [id]: "" });
  };
  const removePlayer = (id, i) =>
    setTeams(teams.map((t) => (t.id === id ? { ...t, players: t.players.filter((_, j) => j !== i) } : t)));
  const addTeam = () => {
    if (teams.length >= 6) return;
    const id = Math.max(0, ...teams.map((t) => t.id)) + 1;
    setTeams([...teams, { id, name: TEAM_NAMES[teams.length] || "Команда", players: [] }]);
  };
  const removeTeam = (id) => teams.length > 2 && setTeams(teams.filter((t) => t.id !== id));

  return (
    <div className="screen screen-anim">
      <div className="shell">
        <button className="back-link" onClick={() => go("home")}><Icon name="arrowLeft" /> На главную</button>

        <div className="setup-head">
          <div>
            <Steps current={1} />
            <h1 className="h-display" style={{ marginTop: 14 }}>Соберите команды</h1>
            <p className="h-sub" style={{ marginTop: 8 }}>Минимум 2 команды по 2 игрока. Имена можно переименовать в любой момент.</p>
          </div>
          <div className="setup-counter">
            <span className="sc-v mono">{total}</span>
            <span className="sc-l">игроков · {teams.length} команды</span>
          </div>
        </div>

        <div className="teams-grid">
          {teams.map((t) => (
            <div className="team-card setup-team" key={t.id} style={{ "--tc": `var(--team-${t.id})` }}>
              <div className="row-between" style={{ marginBottom: 14 }}>
                <div className="row" style={{ gap: 10 }}>
                  <span className="st-swatch" />
                  <input
                    className="st-name-input"
                    value={t.name}
                    onChange={(e) => setTeams(teams.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))}
                  />
                </div>
                <button className="icon-btn" style={{ width: 36 }} onClick={() => removeTeam(t.id)} disabled={teams.length <= 2}>
                  <Icon name="trash" size={16} />
                </button>
              </div>

              <div className="stack" style={{ gap: 8 }}>
                {t.players.map((p, i) => (
                  <div className="slot" key={i}>
                    <Avatar name={p} team={t.id} size={30} />
                    <span className="slot-name">{p}</span>
                    <button className="slot-x" onClick={() => removePlayer(t.id, i)}><Icon name="x" size={15} /></button>
                  </div>
                ))}
                {t.players.length === 0 && <p className="st-empty">Пока пусто — добавь игрока</p>}
              </div>

              <div className="st-add">
                <input
                  className="input"
                  placeholder="Имя игрока"
                  value={draft[t.id] || ""}
                  onChange={(e) => setDraft({ ...draft, [t.id]: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addPlayer(t.id)}
                />
                <button className="btn btn-secondary" onClick={() => addPlayer(t.id)}><Icon name="plus" /></button>
              </div>
            </div>
          ))}

          {teams.length < 6 && (
            <button className="team-add-card" onClick={addTeam}>
              <span className="tac-ic"><Icon name="plus" size={26} /></span>
              Добавить команду
            </button>
          )}
        </div>

        <div className="setup-foot">
          <span className="muted">{total} игроков в {teams.length} командах</span>
          <button className="btn btn-primary btn-lg" onClick={() => go("settings")}>
            Далее · настройки <Icon name="arrowRight" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Steps({ current }) {
  const steps = ["Команды", "Настройки"];
  return (
    <div className="steps">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <span className={"step" + (i + 1 === current ? " on" : "") + (i + 1 < current ? " done" : "")}>
            <b className="mono">{i + 1}</b> {s}
          </span>
          {i < steps.length - 1 && <span className="step-sep" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============ STEP 2 · SETTINGS ============
function SettingsScreen({ go }) {
  const [dur, setDur] = useStateLocal(60);
  const [goal, setGoal] = useStateLocal(50);
  const [penalty, setPenalty] = useStateLocal(true);
  const [cats, setCats] = useStateLocal(["Кино", "Еда", "Животные", "Спорт", "Музыка", "География", "Сленг"]);
  const toggle = (n) => setCats(cats.includes(n) ? cats.filter((x) => x !== n) : [...cats, n]);
  const words = CATEGORIES.filter((c) => cats.includes(c.n)).reduce((s, c) => s + c.c, 0);

  return (
    <div className="screen screen-anim">
      <div className="shell">
        <button className="back-link" onClick={() => go("teams")}><Icon name="arrowLeft" /> Назад к командам</button>

        <div className="setup-head">
          <div>
            <Steps current={2} />
            <h1 className="h-display" style={{ marginTop: 14 }}>Правила партии</h1>
            <p className="h-sub" style={{ marginTop: 8 }}>Настрой темп игры и выбери, о чём будут слова.</p>
          </div>
        </div>

        <div className="settings-grid">
          <div className="stack">
            <div className="card">
              <div className="set-row">
                <div className="set-label"><Icon name="clock" /> Длительность раунда</div>
                <div className="chip-row">
                  {[30, 45, 60, 90].map((d) => <button key={d} className={"chip" + (dur === d ? " on" : "")} onClick={() => setDur(d)}>{d} сек</button>)}
                </div>
              </div>
              <div className="dotted" style={{ margin: "20px 0" }} />
              <div className="set-row">
                <div className="set-label"><Icon name="target" /> Цель по очкам</div>
                <div className="chip-row">
                  {[30, 50, 75, 100].map((g) => <button key={g} className={"chip" + (goal === g ? " on" : "")} onClick={() => setGoal(g)}>{g}</button>)}
                </div>
              </div>
              <div className="dotted" style={{ margin: "20px 0" }} />
              <div className="set-row">
                <div className="set-label"><Icon name="minus" /> Штраф за пропуск
                  <span className="set-hint">снимать −1 очко за пропущенное слово</span>
                </div>
                <div className={"toggle" + (penalty ? " on" : "")} onClick={() => setPenalty(!penalty)} role="switch" aria-checked={penalty} />
              </div>
            </div>

            <div className="card summary-card">
              <span className="eyebrow">итог</span>
              <div className="summary-stats">
                <div><b className="mono">{cats.length}</b><span>категорий</span></div>
                <div><b className="mono">{words}</b><span>слов в игре</span></div>
                <div><b className="mono">{dur}с</b><span>раунд</span></div>
                <div><b className="mono">{goal}</b><span>до победы</span></div>
              </div>
            </div>
          </div>

          <div className="card cats-card">
            <div className="row-between" style={{ marginBottom: 16 }}>
              <h2 className="h-title">Категории слов</h2>
              <span className="pill pill-mono">{cats.length} / 10</span>
            </div>
            <div className="cats-grid">
              {CATEGORIES.map((c) => (
                <div key={c.n} className={"cat-card" + (cats.includes(c.n) ? " on" : "")} onClick={() => toggle(c.n)}>
                  <span className="cat-check"><Icon name="check" size={14} /></span>
                  <span className="cat-emoji">{c.e}</span>
                  <span className="cat-name">{c.n}</span>
                  <span className="cat-count">{c.c} слов</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="setup-foot">
          <span className="muted">{words} слов · {cats.length} категорий выбрано</span>
          <button className="btn btn-primary btn-lg" style={{ opacity: cats.length ? 1 : 0.5 }} onClick={() => go("gameExplainer")}>
            <Icon name="play" /> Начать игру
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ PASS DEVICE (local) ============
const PASS_TEAMS = [
  { id: 1, name: "Мятные", score: 25 },
  { id: 3, name: "Лиловые", score: 22 },
  { id: 2, name: "Янтарные", score: 18 },
];

function PassScreen({ go }) {
  const next = { team: 3, name: "Соня", players: ["Соня", "Паша", "Кира"] };
  const sorted = [...PASS_TEAMS].sort((a, b) => b.score - a.score);

  return (
    <div className="screen center-screen screen-anim">
      <div className="shell">
        <div className="pass-wrap" style={{ "--tc": `var(--team-${next.team})` }}>
          <div className="pass-hero">
            <span className="eyebrow">передай устройство</span>
            <div className="pass-avatar">
              <Avatar name={next.name} team={next.team} size={92} />
            </div>
            <h1 className="pass-name">{next.name}</h1>
            <p className="pass-team">объясняет за команду «{TEAM_NAMES[next.team - 1] || next.team}»</p>
            <div className="pass-players">
              {next.players.map((p) => (
                <span className="pass-chip mono" key={p}>{p}</span>
              ))}
            </div>
          </div>

          <div className="pass-side">
            <div className="card pass-score">
              <span className="eyebrow">текущий счёт</span>
              <div className="pass-score-list">
                {sorted.map((t, i) => (
                  <div className={"pass-score-row" + (i === 0 ? " lead" : "")} key={t.id} style={{ "--tc": `var(--team-${t.id})` }}>
                    <span className="psr-rank mono">{i + 1}</span>
                    <span className="psr-dot" />
                    <span className="psr-name">{t.name}</span>
                    {i === 0 && <Icon name="crown" size={15} className="psr-crown" />}
                    <span className="psr-score mono">{t.score}</span>
                  </div>
                ))}
              </div>
            </div>

            <button className="btn btn-primary btn-lg btn-block pass-go" onClick={() => go("gameExplainer")}>
              <Icon name="play" /> Я готов · начать раунд
            </button>
            <p className="pass-note mono"><Icon name="eyeOff" size={14} /> Слово увидишь только ты</p>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TeamsScreen, SettingsScreen, Steps, PassScreen });
