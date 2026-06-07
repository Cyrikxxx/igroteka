/* global React, Icon, Avatar, useCountUp */
const { useState: useStateHist } = React;

// ---- mock history data (matches brief: online/local, codes, teams, scores) ----
const HISTORY = [
  {
    id: "g1", status: "live", mode: "online", code: "VPYZQQ", date: "Сейчас",
    round: 4, teams: [
      { id: 1, name: "Мятные", score: 32 },
      { id: 3, name: "Лиловые", score: 28 },
      { id: 2, name: "Янтарные", score: 19 },
    ], winner: null,
  },
  {
    id: "g2", status: "done", mode: "local", code: null, date: "Сегодня · 19:42",
    round: 8, teams: [
      { id: 1, name: "Мятные", score: 52 },
      { id: 4, name: "Небесные", score: 47 },
    ], winner: 1,
  },
  {
    id: "g3", status: "done", mode: "online", code: "KX8MTA", date: "Вчера · 21:10",
    round: 10, teams: [
      { id: 5, name: "Алые", score: 61 },
      { id: 2, name: "Янтарные", score: 55 },
      { id: 6, name: "Лаймовые", score: 50 },
      { id: 3, name: "Лиловые", score: 41 },
    ], winner: 5,
  },
  {
    id: "g4", status: "done", mode: "local", code: null, date: "3 июня · 18:05",
    round: 6, teams: [
      { id: 3, name: "Лиловые", score: 40 },
      { id: 1, name: "Мятные", score: 38 },
    ], winner: 3,
  },
];

function GameRow({ g, go, onDelete }) {
  const sorted = [...g.teams].sort((a, b) => b.score - a.score);
  const live = g.status === "live";
  return (
    <div className={"hist-card" + (live ? " live" : "")}>
      <div className="hist-card-head">
        <div className="hist-meta">
          {live
            ? <span className="pill pill-live"><span className="dot dot-pulse" /> LIVE</span>
            : <span className="pill pill-mono"><Icon name="check" size={13} /> завершена</span>}
          <span className="pill pill-mono">
            <Icon name={g.mode === "online" ? "wifi" : "smartphone"} size={13} />
            {g.mode === "online" ? "онлайн" : "локально"}
          </span>
          {g.code && <span className="hist-code mono">#{g.code}</span>}
        </div>
        <span className="hist-date mono">{g.date}</span>
      </div>

      <div className="hist-teams">
        {sorted.map((t) => {
          const isWin = (live ? sorted[0].id === t.id : g.winner === t.id);
          return (
            <div className={"hist-team" + (isWin ? " win" : "")} key={t.id} style={{ "--tc": `var(--team-${t.id})` }}>
              <span className="ht-dot" />
              <span className="ht-name">{t.name}</span>
              {isWin && !live && <Icon name="crown" size={15} className="ht-crown" />}
              <span className="ht-score mono">{t.score}</span>
            </div>
          );
        })}
      </div>

      <div className="hist-foot">
        <span className="hist-round mono">{g.round} раундов</span>
        <div className="hist-actions">
          {live
            ? <button className="btn btn-primary btn-sm" onClick={() => go("gameExplainer")}><Icon name="play" size={15} /> Продолжить</button>
            : <button className="btn btn-secondary btn-sm" onClick={() => go("victory")}><Icon name="trophy" size={15} /> Итоги</button>}
          <button className="icon-btn" style={{ width: 38 }} onClick={() => onDelete(g.id)} title="Удалить"><Icon name="trash" size={16} /></button>
        </div>
      </div>
    </div>
  );
}

function HistoryScreen({ go }) {
  const [games, setGames] = useStateHist(HISTORY);
  const [filter, setFilter] = useStateHist("all");
  const del = (id) => setGames(games.filter((g) => g.id !== id));
  const shown = games.filter((g) => filter === "all" ? true : g.mode === filter);

  const played = useCountUp(48, 800);
  const words = useCountUp(1247, 1000);
  const rate = useCountUp(73, 900);

  return (
    <div className="screen screen-anim">
      <div className="shell">
        <button className="back-link" onClick={() => go("home")}><Icon name="arrowLeft" /> На главную</button>

        <div className="setup-head">
          <div>
            <span className="eyebrow">архив · твои партии</span>
            <h1 className="h-display" style={{ marginTop: 10 }}>История игр</h1>
            <p className="h-sub" style={{ marginTop: 8 }}>Все сыгранные партии, статистика и незавершённые игры — можно вернуться и доиграть.</p>
          </div>
        </div>

        {/* summary stats */}
        <div className="hist-stats">
          <div className="stat"><span className="v mono">{played}</span><span className="l">сыграно игр</span></div>
          <div className="stat"><span className="v mono accent-text">{words.toLocaleString("ru")}</span><span className="l">угадано слов</span></div>
          <div className="stat"><span className="v mono">{rate}%</span><span className="l">успешных объяснений</span></div>
          <div className="stat"><span className="v mono">Мятные</span><span className="l">любимая команда</span></div>
        </div>

        {/* filters */}
        <div className="hist-bar">
          <div className="chip-row">
            {[["all", "Все"], ["online", "Онлайн"], ["local", "Локально"]].map(([k, l]) => (
              <button key={k} className={"chip" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>
                {k === "online" && <Icon name="wifi" size={15} />}
                {k === "local" && <Icon name="smartphone" size={15} />}
                {l}
              </button>
            ))}
          </div>
          <span className="muted mono" style={{ fontSize: 13 }}>{shown.length} {shown.length === 1 ? "партия" : "партий"}</span>
        </div>

        {/* list */}
        {shown.length ? (
          <div className="hist-list">
            {shown.map((g) => <GameRow key={g.id} g={g} go={go} onDelete={del} />)}
          </div>
        ) : (
          <div className="hist-empty card">
            <span className="he-ic"><Icon name="dice" size={32} /></span>
            <h2 className="h-title">Здесь пока пусто</h2>
            <p className="h-sub">Сыграй первую партию — она появится в истории, и можно будет вернуться к ней.</p>
            <button className="btn btn-primary btn-lg" onClick={() => go("home")} style={{ marginTop: 8 }}><Icon name="play" /> Начать игру</button>
          </div>
        )}
      </div>
    </div>
  );
}

window.HistoryScreen = HistoryScreen;
