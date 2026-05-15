"use client";

// Setup step 1: команды. См. DESIGN.md §5.2 TeamsScreen.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  DEFAULT_TEAM_NAMES,
  teamColorVar,
} from "@/constants/game";
import Header from "@/components/ui/Header";
import Stepper from "@/components/ui/Stepper";
import Card from "@/components/ui/Card";
import Pill from "@/components/ui/Pill";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

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

  const updateTeamName = (idx: number, name: string) => {
    setState((s) => ({
      ...s,
      teams: s.teams.map((t, i) => (i === idx ? { ...t, name } : t)),
    }));
  };

  const updatePlayerName = (teamIdx: number, playerIdx: number, name: string) => {
    setState((s) => ({
      ...s,
      teams: s.teams.map((t, i) =>
        i === teamIdx
          ? {
              ...t,
              players: t.players.map((p, j) => (j === playerIdx ? { name } : p)),
            }
          : t,
      ),
    }));
  };

  const addPlayer = (teamIdx: number) => {
    setState((s) => ({
      ...s,
      teams: s.teams.map((t, i) =>
        i === teamIdx && t.players.length < MAX_PLAYERS_PER_TEAM
          ? { ...t, players: [...t.players, { name: "" }] }
          : t,
      ),
    }));
  };

  const removePlayer = (teamIdx: number, playerIdx: number) => {
    setState((s) => ({
      ...s,
      teams: s.teams.map((t, i) =>
        i === teamIdx && t.players.length > MIN_PLAYERS_PER_TEAM
          ? { ...t, players: t.players.filter((_, j) => j !== playerIdx) }
          : t,
      ),
    }));
  };

  const addTeam = () => {
    setState((s) => {
      if (s.teams.length >= MAX_TEAMS) return s;
      const name = DEFAULT_TEAM_NAMES[s.teams.length] ?? `Команда ${s.teams.length + 1}`;
      return {
        ...s,
        teams: [...s.teams, { name, players: [{ name: "" }, { name: "" }] }],
      };
    });
  };

  const removeTeam = (idx: number) => {
    setState((s) => ({
      ...s,
      teams: s.teams.length > MIN_TEAMS ? s.teams.filter((_, i) => i !== idx) : s.teams,
    }));
  };

  const validate = (): string | null => {
    if (state.teams.length < MIN_TEAMS) return `Нужно минимум ${MIN_TEAMS} команды`;
    for (const team of state.teams) {
      if (!team.name.trim()) return "У всех команд должно быть название";
      if (team.players.length < MIN_PLAYERS_PER_TEAM) {
        return `В каждой команде минимум ${MIN_PLAYERS_PER_TEAM} игрока`;
      }
      if (team.players.some((p) => !p.name.trim())) {
        return "У всех игроков должно быть имя";
      }
    }
    return null;
  };

  const onNext = () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    router.push("/local/settings");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 md:px-8 py-8 md:py-12">
        <div className="mb-6">
          <Stepper step={1} />
        </div>
        <h1 className="h-display mb-2">Команды</h1>
        <p className="mb-8" style={{ color: "var(--fg-2)" }}>
          От {MIN_TEAMS} до {MAX_TEAMS} команд по {MIN_PLAYERS_PER_TEAM}–{MAX_PLAYERS_PER_TEAM} игроков.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {state.teams.map((team, teamIdx) => {
            const colorVar = teamColorVar(teamIdx);
            return (
              <Card
                key={teamIdx}
                style={{
                  background: `linear-gradient(180deg, color-mix(in oklch, var(${colorVar}) 12%, var(--bg-1)), var(--bg-1))`,
                  borderColor: `color-mix(in oklch, var(${colorVar}) 30%, var(--line-strong))`,
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <input
                    value={team.name}
                    onChange={(e) => updateTeamName(teamIdx, e.target.value)}
                    placeholder="Название"
                    className="bg-transparent outline-none font-extrabold text-lg tracking-tight"
                    style={{ color: `var(${colorVar})` }}
                  />
                  <div className="flex items-center gap-2">
                    <Pill mono>
                      {team.players.length}/{MAX_PLAYERS_PER_TEAM}
                    </Pill>
                    {state.teams.length > MIN_TEAMS && (
                      <button
                        type="button"
                        onClick={() => removeTeam(teamIdx)}
                        className="text-xs underline"
                        style={{ color: "var(--fg-3)" }}
                        aria-label="Удалить команду"
                      >
                        удалить
                      </button>
                    )}
                  </div>
                </div>

                <ul className="flex flex-col gap-2">
                  {team.players.map((player, playerIdx) => (
                    <li key={playerIdx} className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          background: `color-mix(in oklch, var(${colorVar}) 25%, var(--bg-2))`,
                          color: `var(${colorVar})`,
                        }}
                      >
                        {(player.name || "?").charAt(0).toUpperCase()}
                      </span>
                      <Input
                        value={player.name}
                        onChange={(e) => updatePlayerName(teamIdx, playerIdx, e.target.value)}
                        placeholder={`Игрок ${playerIdx + 1}`}
                      />
                      {team.players.length > MIN_PLAYERS_PER_TEAM && (
                        <button
                          type="button"
                          onClick={() => removePlayer(teamIdx, playerIdx)}
                          aria-label="Удалить игрока"
                          className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                          style={{
                            background: "var(--bg-2)",
                            color: "var(--fg-3)",
                            border: "1px solid var(--line)",
                          }}
                        >
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                {team.players.length < MAX_PLAYERS_PER_TEAM && (
                  <button
                    type="button"
                    onClick={() => addPlayer(teamIdx)}
                    className="mt-3 w-full h-10 rounded-md text-sm font-semibold"
                    style={{
                      background: "transparent",
                      color: "var(--fg-2)",
                      border: "1px dashed var(--line-strong)",
                    }}
                  >
                    + Добавить игрока
                  </button>
                )}
              </Card>
            );
          })}

          {state.teams.length < MAX_TEAMS && (
            <Card
              flat
              dashed
              className="flex items-center justify-center min-h-[160px] cursor-pointer"
              onClick={addTeam}
            >
              <span className="text-base font-semibold" style={{ color: "var(--fg-2)" }}>
                + Добавить команду
              </span>
            </Card>
          )}
        </div>

        {error && (
          <div
            className="mt-6 p-3 rounded-md text-sm"
            style={{
              background: "color-mix(in oklch, var(--danger) 12%, var(--bg-2))",
              color: "var(--danger)",
              border: "1px solid color-mix(in oklch, var(--danger) 30%, transparent)",
            }}
          >
            {error}
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse md:flex-row gap-3 md:justify-between">
          <Button variant="ghost" size="lg" onClick={() => router.push("/")}>
            ← Назад
          </Button>
          <Button size="lg" block={false} onClick={onNext}>
            Дальше: настройки →
          </Button>
        </div>
      </main>
    </div>
  );
}
