/* global React, Icon, RoomCode, QrCode, Avatar */
const { useState: useStateOnline } = React;

// ============ JOIN BY CODE ============
function JoinScreen({ go }) {
  const [code, setCode] = useStateOnline(["V", "P", "Y", "Z", "", ""]);
  const [name, setName] = useStateOnline("");
  const [err, setErr] = useStateOnline(false);
  const refs = React.useRef([]);

  const setChar = (i, v) => {
    const c = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
    const next = [...code];
    next[i] = c;
    setCode(next);
    setErr(false);
    if (c && i < 5) refs.current[i + 1]?.focus();
  };
  const onKey = (i, e) => {
    if (e.key === "Backspace" && !code[i] && i > 0) refs.current[i - 1]?.focus();
  };
  const full = code.every((c) => c) && name.trim();

  return (
    <div className="screen center-screen screen-anim">
      <div className="shell">
        <div className="form-narrow">
          <button className="back-link" onClick={() => go("home")}><Icon name="arrowLeft" /> На главную</button>
          <div className="card form-card">
            <div className="form-head">
              <span className="form-ic"><Icon name="hash" size={26} /></span>
              <div>
                <h1 className="h-title">Войти в комнату</h1>
                <p className="h-sub">Введи 6-значный код, который дал хост, или открой ссылку-приглашение.</p>
              </div>
            </div>

            <label className="field-label">Код комнаты</label>
            <div className="join-code">
              {code.map((c, i) => (
                <input
                  key={i}
                  ref={(el) => (refs.current[i] = el)}
                  className={"join-cell" + (err ? " err" : "")}
                  value={c}
                  onChange={(e) => setChar(i, e.target.value)}
                  onKeyDown={(e) => onKey(i, e)}
                  inputMode="text"
                  maxLength={1}
                  aria-label={"символ " + (i + 1)}
                />
              ))}
            </div>
            {err && <p className="join-err"><Icon name="x" size={15} /> Комната не найдена. Проверь код.</p>}

            <label className="field-label" style={{ marginTop: 22 }}>Твоё имя</label>
            <input className="input" placeholder="Например, Аня" value={name} onChange={(e) => setName(e.target.value)} />

            <button
              className="btn btn-primary btn-lg btn-block"
              style={{ marginTop: 22, opacity: full ? 1 : 0.55 }}
              onClick={() => (full ? go("lobbyGuest") : setErr(true))}
            >
              Войти <Icon name="arrowRight" />
            </button>

            <div className="join-or"><span>или</span></div>
            <button className="btn btn-secondary btn-block"><Icon name="qr" /> Сканировать QR-код</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ CREATE ONLINE ROOM (settings-rich) ============
function CreateRoomScreen({ go }) {
  const [host, setHost] = useStateOnline("");
  const [room, setRoom] = useStateOnline("");
  const [dur, setDur] = useStateOnline(60);
  const [goal, setGoal] = useStateOnline(50);
  const [penalty, setPenalty] = useStateOnline(true);
  const [cats, setCats] = useStateOnline(["Кино", "Еда", "Животные", "Спорт", "Музыка", "География", "Сленг"]);
  const toggle = (n) => setCats(cats.includes(n) ? cats.filter((x) => x !== n) : [...cats, n]);
  const words = CATEGORIES.filter((c) => cats.includes(c.n)).reduce((s, c) => s + c.c, 0);
  const roomTitle = room.trim() || (host.trim() ? `Комната ${host.trim()}` : "Комната хоста");

  return (
    <div className="screen screen-anim">
      <div className="shell">
        <button className="back-link" onClick={() => go("home")}><Icon name="arrowLeft" /> На главную</button>

        <div className="setup-head">
          <div>
            <span className="eyebrow">онлайн · новая комната</span>
            <h1 className="h-display" style={{ marginTop: 10 }}>Создать комнату</h1>
            <p className="h-sub" style={{ marginTop: 8 }}>Задай имя и правила. Всё это можно поменять потом прямо в лобби.</p>
          </div>
          <div className="setup-counter">
            <span className="sc-v mono">{cats.length ? words : 0}</span>
            <span className="sc-l">слов · {cats.length} категорий</span>
          </div>
        </div>

        <div className="settings-grid">
          <div className="stack">
            {/* Room identity */}
            <div className="card">
              <span className="eyebrow">комната</span>
              <label className="field-label" style={{ marginTop: 14 }}>Имя хоста</label>
              <input className="input" placeholder="Например, Макс" value={host} onChange={(e) => setHost(e.target.value)} />
              <label className="field-label" style={{ marginTop: 18 }}>
                Имя комнаты <span className="label-opt">необязательно</span>
              </label>
              <input className="input" placeholder={host.trim() ? `Комната ${host.trim()}` : "Комната хоста"} value={room} onChange={(e) => setRoom(e.target.value)} />
              <p className="field-note"><Icon name="sparkles" size={13} /> Если пусто — назовём «{roomTitle}»</p>
            </div>

            {/* Rules */}
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
          </div>

          {/* Categories */}
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
          <span className="muted">«{roomTitle}» · {dur}с · до {goal} · {cats.length} категорий</span>
          <button
            className="btn btn-primary btn-lg"
            style={{ opacity: host.trim() && cats.length ? 1 : 0.5 }}
            onClick={() => (host.trim() && cats.length ? go("lobbyHost") : null)}
          >
            <Icon name="wifi" /> Создать комнату
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ LOBBY ============
const LOBBY_TEAMS = [
  { id: 1, name: "Мятные", players: [{ n: "Макс", host: true }, { n: "Аня" }, { n: "Игорь" }] },
  { id: 2, name: "Янтарные", players: [{ n: "Лена" }, { n: "Дима" }] },
  { id: 3, name: "Лиловые", players: [{ n: "Соня" }, { n: "Паша" }, { n: "Кира" }] },
];

function PlayerRow({ p, team, you }) {
  return (
    <div className="lobby-player">
      <Avatar name={p.n} team={team} size={30} online />
      <span className="lp-name">{p.n}{you && <em> · ты</em>}</span>
      {p.host && <span className="pill pill-mono pill-accent">хост</span>}
    </div>
  );
}

function LobbyTeamCard({ team, host, youTeam }) {
  return (
    <div className="team-card lobby-team" style={{ "--tc": `var(--team-${team.id})` }}>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <div className="lt-title">
          <span className="lt-name">{team.name}</span>
          <span className="lt-count mono">{team.players.length} игрока</span>
        </div>
        {host && <button className="icon-btn" style={{ width: 36 }}><Icon name="edit" size={16} /></button>}
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {team.players.map((p, i) => <PlayerRow key={i} p={p} team={team.id} you={youTeam === team.id && i === 1} />)}
        {host && (
          <button className="lobby-add"><Icon name="plus" size={16} /> Перетащи игрока сюда</button>
        )}
      </div>
    </div>
  );
}

function LobbyScreen({ go, role }) {
  const host = role === "host";
  const [copied, setCopied] = useStateOnline(false);
  const total = LOBBY_TEAMS.reduce((s, t) => s + t.players.length, 0);
  const copy = () => { setCopied(true); setTimeout(() => setCopied(false), 1600); };

  return (
    <div className="screen screen-anim">
      <div className="shell">
        <button className="back-link" onClick={() => go("home")}><Icon name="arrowLeft" /> Выйти из комнаты</button>

        <div className="lobby-head">
          <div>
            <span className="eyebrow">{host ? "лобби · хост" : "лобби · участник"}</span>
            <h1 className="h-display" style={{ marginTop: 8 }}>
              {host ? "Ждём игроков" : "Ты в комнате"}
            </h1>
            <p className="h-sub" style={{ marginTop: 8 }}>
              {host
                ? "Раскидай игроков по командам и запускай, когда все соберутся."
                : "Хост скоро начнёт игру. Можешь сменить команду, пока идёт сбор."}
            </p>
          </div>
        </div>

        <div className="lobby-grid">
          {/* Invite panel */}
          <aside className="lobby-invite">
            <div className="card invite-card">
              <span className="eyebrow">код комнаты</span>
              <div className="invite-code"><RoomCode code="VPYZQQ" /></div>
              <div className="invite-actions">
                <button className="btn btn-secondary btn-sm" onClick={copy}>
                  <Icon name={copied ? "check" : "copy"} /> {copied ? "Скопировано" : "Копировать"}
                </button>
                <button className="btn btn-secondary btn-sm"><Icon name="share" /> Поделиться</button>
              </div>
              <div className="dotted" style={{ margin: "22px 0" }} />
              <div className="invite-qr">
                <div className="qr"><QrCode value="https://alias.online/r/VPYZQQ" /></div>
                <div>
                  <p className="invite-qr-t">Сканируй, чтобы войти</p>
                  <p className="invite-qr-s mono">alias.online/r/VPYZQQ</p>
                </div>
              </div>
            </div>

            <div className="card lobby-rules">
              <div className="row-between"><span className="lr-l">Раунд</span><span className="lr-v mono">60 сек</span></div>
              <div className="row-between"><span className="lr-l">Цель</span><span className="lr-v mono">50 очков</span></div>
              <div className="row-between"><span className="lr-l">Штраф за пропуск</span><span className="lr-v mono">−1</span></div>
              <div className="row-between"><span className="lr-l">Категорий</span><span className="lr-v mono">7 из 10</span></div>
              {host && <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 8 }}><Icon name="settings" /> Изменить настройки</button>}
            </div>
          </aside>

          {/* Teams */}
          <div className="lobby-teams-wrap">
            <div className="row-between lobby-teams-head">
              <h2 className="h-title">Команды</h2>
              {host && <button className="btn btn-secondary btn-sm"><Icon name="plus" /> Команда</button>}
            </div>
            <div className="lobby-teams">
              {LOBBY_TEAMS.map((t) => (
                <LobbyTeamCard key={t.id} team={t} host={host} youTeam={host ? null : 2} />
              ))}
            </div>
          </div>
        </div>

        {/* Sticky action */}
        <div className="lobby-foot">
          {host ? (
            <>
              <span className="muted">{total} игроков · 3 команды готовы</span>
              <div className="row" style={{ gap: 10 }}>
                <button className="btn btn-ghost"><Icon name="logout" /> Закрыть комнату</button>
                <button className="btn btn-primary btn-lg" onClick={() => go("gameExplainer")}>
                  <Icon name="play" /> Начать игру
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="muted">Ты в команде «Янтарные»</span>
              <div className="row" style={{ gap: 10 }}>
                <button className="btn btn-secondary"><Icon name="refresh" /> Сменить команду</button>
                <span className="pill"><Icon name="clock" /> Ждём старта…</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { JoinScreen, CreateRoomScreen, LobbyScreen });
