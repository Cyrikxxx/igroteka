"use client";

// Локальная игра — шаг 1: команды. Дизайн — TeamsScreen из редизайна.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Plus, Trash2, X } from "lucide-react";
import {
  loadLocalSetup,
  saveLocalSetup,
  DEFAULT_LOCAL_SETUP,
  type LocalSetupState,
} from "@/lib/local-setup";
import {
  MIN_TEAMS,
  MAX_TEAMS,
  MIN_PLAYERS_PER_TEAM,
  MAX_PLAYERS_PER_TEAM,
  teamColorVar,
} from "@/constants/game";
import { nextUnusedTeamName } from "@alias/shared/snapshot-builders";
import { plural, pluralize, PLAYERS, TEAMS, TEAMS_IN } from "@/lib/plural";
import AppShell from "@/components/common/AppShell";
import Stepper from "@/components/common/Stepper";
import Avatar from "@/components/common/Avatar";

export default function LocalNewPage() {
  const router = useRouter();
  const [state, setState] = useState<LocalSetupState>(DEFAULT_LOCAL_SETUP);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState(loadLocalSetup());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveLocalSetup(state);
  }, [state, hydrated]);

  const updateTeamName = (idx: number, name: string) =>
    setState((s) => ({ ...s, teams: s.teams.map((t, i) => (i === idx ? { ...t, name } : t)) }));

  const updatePlayerName = (teamIdx: number, playerIdx: number, name: string) =>
    setState((s) => ({
      ...s,
      teams: s.teams.map((t, i) =>
        i === teamIdx
          ? { ...t, players: t.players.map((p, j) => (j === playerIdx ? { name } : p)) }
          : t,
      ),
    }));

  const addPlayer = (teamIdx: number) =>
    setState((s) => ({
      ...s,
      teams: s.teams.map((t, i) =>
        i === teamIdx && t.players.length < MAX_PLAYERS_PER_TEAM
          ? { ...t, players: [...t.players, { name: "" }] }
          : t,
      ),
    }));

  const removePlayer = (teamIdx: number, playerIdx: number) =>
    setState((s) => ({
      ...s,
      teams: s.teams.map((t, i) =>
        i === teamIdx && t.players.length > MIN_PLAYERS_PER_TEAM
          ? { ...t, players: t.players.filter((_, j) => j !== playerIdx) }
          : t,
      ),
    }));

  const addTeam = () =>
    setState((s) => {
      if (s.teams.length >= MAX_TEAMS) return s;
      // Имя — первое свободное, а не по индексу: иначе после удаления команды
      // из середины следующая получала уже занятое название.
      const name = nextUnusedTeamName(s.teams.map((t) => t.name));
      return { ...s, teams: [...s.teams, { name, players: [{ name: "" }, { name: "" }] }] };
    });

  const removeTeam = (idx: number) =>
    setState((s) => ({
      ...s,
      teams: s.teams.length > MIN_TEAMS ? s.teams.filter((_, i) => i !== idx) : s.teams,
    }));

  const total = state.teams.reduce((sum, t) => sum + t.players.length, 0);

  const validate = (): string | null => {
    if (state.teams.length < MIN_TEAMS) return `Нужно минимум ${MIN_TEAMS} команды`;
    for (const team of state.teams) {
      if (!team.name.trim()) return "У всех команд должно быть название";
      if (team.players.length < MIN_PLAYERS_PER_TEAM)
        return `В каждой команде минимум ${MIN_PLAYERS_PER_TEAM} игрока`;
      if (team.players.some((p) => !p.name.trim())) return "У всех игроков должно быть имя";
    }
    return null;
  };

  const onNext = () => {
    const err = validate();
    if (err) return setError(err);
    router.push("/alias/local/settings");
  };

  return (
    <AppShell className="screen-anim">
      <button type="button" className="back-link" onClick={() => router.push("/alias")}>
        <ArrowLeft /> К Алиасу
      </button>

      <div className="setup-head">
        <div>
          <Stepper step={1} />
          <h1 className="h-display" style={{ marginTop: 14 }}>
            Соберите команды
          </h1>
          <p className="h-sub" style={{ marginTop: 8 }}>
            От {MIN_TEAMS} до {MAX_TEAMS} команд по {MIN_PLAYERS_PER_TEAM}–{MAX_PLAYERS_PER_TEAM}{" "}
            игроков. Имена можно менять в любой момент.
          </p>
        </div>
        <div className="setup-counter">
          <span className="sc-v mono">{total}</span>
          <span className="sc-l">
            {plural(total, PLAYERS)} · {pluralize(state.teams.length, TEAMS)}
          </span>
        </div>
      </div>

      <div className="teams-grid">
        {state.teams.map((team, teamIdx) => {
          const colorVar = teamColorVar(teamIdx);
          return (
            <div
              key={teamIdx}
              className="team-card setup-team"
              style={{ "--tc": `var(${colorVar})` } as React.CSSProperties}
            >
              <div className="row-between" style={{ marginBottom: 14 }}>
                <div className="row" style={{ gap: 10, flex: 1, minWidth: 0 }}>
                  <span className="st-swatch" />
                  <input
                    className="st-name-input"
                    value={team.name}
                    onChange={(e) => updateTeamName(teamIdx, e.target.value.slice(0, 30))}
                    placeholder="Название"
                  />
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 36, flex: "none" }}
                  onClick={() => removeTeam(teamIdx)}
                  disabled={state.teams.length <= MIN_TEAMS}
                  aria-label="Удалить команду"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="stack" style={{ gap: 8 }}>
                {team.players.map((player, playerIdx) => (
                  <div className="slot" key={playerIdx}>
                    <Avatar name={player.name} color={colorVar} size={30} />
                    <input
                      className="slot-name"
                      style={{ background: "transparent", border: 0, outline: "none", color: "var(--fg)" }}
                      value={player.name}
                      onChange={(e) => updatePlayerName(teamIdx, playerIdx, e.target.value.slice(0, 50))}
                      placeholder={`Игрок ${playerIdx + 1}`}
                    />
                    {team.players.length > MIN_PLAYERS_PER_TEAM && (
                      <button
                        type="button"
                        className="slot-x"
                        onClick={() => removePlayer(teamIdx, playerIdx)}
                        aria-label="Удалить игрока"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
                {team.players.length < MAX_PLAYERS_PER_TEAM && (
                  <button type="button" className="lobby-add" onClick={() => addPlayer(teamIdx)}>
                    <Plus size={16} /> Добавить игрока
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {state.teams.length < MAX_TEAMS && (
          <button type="button" className="team-add-card" onClick={addTeam}>
            <span className="tac-ic">
              <Plus size={26} />
            </span>
            Добавить команду
          </button>
        )}
      </div>

      {error && (
        <div className="notice notice-danger" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      <div className="setup-foot">
        {/* Причину, по которой ещё нельзя дальше, показываем сразу, а не
            после нажатия — кнопку при этом не блокируем. */}
        <span className="muted">
          {validate() ?? `${pluralize(total, PLAYERS)} в ${pluralize(state.teams.length, TEAMS_IN)}`}
        </span>
        <button type="button" className="btn btn-primary btn-lg" onClick={onNext}>
          Далее · настройки <ArrowRight />
        </button>
      </div>
    </AppShell>
  );
}
