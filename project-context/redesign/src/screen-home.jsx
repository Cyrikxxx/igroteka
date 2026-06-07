/* global React, Icon, RoomCode */
/* Home / hero */
function HomeScreen({ go }) {
  const ctas = [
    { id: "create", icon: "wifi", title: "Создать онлайн-комнату", sub: "/room/new", desc: "Каждый со своего телефона, в реальном времени", primary: true, to: "create" },
    { id: "local", icon: "smartphone", title: "На одном устройстве", sub: "/local/new", desc: "Одна компания, один телефон по кругу", to: "teams" },
    { id: "join", icon: "hash", title: "Войти по коду", sub: "/join", desc: "Есть код комнаты от друга? Заходи", to: "join" },
  ];
  const feats = [
    { icon: "zap", t: "Без регистрации" },
    { icon: "sparkles", t: "10 категорий · 629 слов" },
    { icon: "smartphone", t: "Работает на любом телефоне" },
  ];

  return (
    <div className="screen screen-anim">
      <div className="shell">
        <div className="home-grid">
          {/* Left: copy + CTAs */}
          <div className="home-copy">
            <div className="home-badges">
              <span className="pill pill-mono pill-accent"><Icon name="sparkles" /> v2 · online party</span>
              <span className="pill pill-mono"><Icon name="users" /> 5–32 игрока</span>
            </div>

            <h1 className="h-mega home-title">
              <span className="outline-text">АЛИАС</span><br />
              <span>В РЕАЛЬНОМ</span><br />
              <span className="accent-text">ВРЕМЕНИ</span>
            </h1>

            <p className="h-sub home-lead">
              Объясняй слово, не называя его. Собери друзей в одну комнату —
              каждый играет со своего телефона, счёт обновляется на лету.
            </p>

            <div className="home-ctas">
              {ctas.map((c) => (
                <button
                  key={c.id}
                  className={"home-cta" + (c.primary ? " home-cta--primary" : "")}
                  onClick={() => go(c.to)}
                >
                  <span className="home-cta-ic"><Icon name={c.icon} size={24} /></span>
                  <span className="home-cta-body">
                    <span className="home-cta-title">{c.title}</span>
                    <span className="home-cta-desc">{c.desc}</span>
                  </span>
                  <span className="home-cta-sub mono">{c.sub}</span>
                  <span className="home-cta-arrow"><Icon name="arrowRight" size={20} /></span>
                </button>
              ))}
            </div>

            <div className="home-feats">
              {feats.map((f) => (
                <span className="feat" key={f.t}>
                  <span className="fi"><Icon name={f.icon} /></span>
                  {f.t}
                </span>
              ))}
            </div>
          </div>

          {/* Right: decorative stage */}
          <div className="home-stage" aria-hidden="true">
            <div className="hs-glow" />
            <div className="hs-card hs-card--word">
              <span className="eyebrow">слово · кино</span>
              <strong>Титаник</strong>
              <div className="hs-timer">
                <span className="mono">0:42</span>
                <div className="hs-track"><span style={{ width: "62%" }} /></div>
              </div>
            </div>

            <div className="hs-card hs-card--mini hs-card--got">
              <Icon name="check" size={18} /> угадано <b>+1</b>
            </div>
            <div className="hs-card hs-card--mini hs-card--skip">
              <Icon name="forward" size={18} /> пропуск
            </div>

            <div className="hs-card hs-card--score">
              <div className="hs-team" style={{ "--tc": "var(--team-1)" }}>
                <span className="hs-dot" /> Мятные
                <b className="mono">14</b>
              </div>
              <div className="hs-team" style={{ "--tc": "var(--team-3)" }}>
                <span className="hs-dot" /> Лиловые
                <b className="mono">11</b>
              </div>
              <div className="hs-team" style={{ "--tc": "var(--team-2)" }}>
                <span className="hs-dot" /> Янтарные
                <b className="mono">9</b>
              </div>
            </div>

            <div className="hs-card hs-card--code">
              <span className="eyebrow">код комнаты</span>
              <RoomCode code="VPYZQQ" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.HomeScreen = HomeScreen;
