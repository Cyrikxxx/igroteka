// Круг игры втроём целиком: создать локальную партию из трёх человек и
// отыграть шесть ходов через настоящий REST, как это делает браузер.
//
// Проверяет то, ради чего режим и делался: за круг каждый должен рассказать
// каждому и поугадывать у каждого, а очки за раунд получают оба игрока пары —
// отдыхающий не получает ничего.
//
// Запуск: `npm run smoke:trio` при поднятом `npm run dev:web-only`.

import "../src/env";

const WEB = "http://localhost:3000";
const NAMES = ["Аня", "Боря", "Вера"];
/** Сколько слов угадываем на каждом ходу — по одному на игрока, чтобы счёт был читаемым. */
const GUESSED_PER_ROUND = [3, 5, 2, 4, 6, 1];

interface Team {
  id: number;
  name: string;
  order: number;
  score: number;
  players: { id: number; name: string }[];
}
interface Game {
  id: string;
  format: string;
  trioTurn: number;
  status: string;
  currentTeamIndex: number;
  currentRoundNumber: number;
  teams: Team[];
}

const jar = new Map<string, string>();
function readCookies(res: Response) {
  const sc = res.headers.get("set-cookie");
  if (sc) {
    const m = sc.match(/^([^=]+)=([^;]+)/);
    if (m) jar.set(m[1], m[2]);
  }
}
function cookie(): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${WEB}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", cookie: cookie(), ...(init?.headers ?? {}) },
  });
  readCookies(res);
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

function assert(ok: boolean, what: string) {
  if (!ok) throw new Error(`ПРОВАЛ: ${what}`);
  console.log(`  ok · ${what}`);
}

async function categoryIdsBySlug(...slugs: string[]): Promise<number[]> {
  const catalog = await api<{
    levels: { id: number; slug: string }[];
    collections: { categories: { id: number; slug: string }[] }[];
  }>("/api/categories");
  const all = [...catalog.levels, ...catalog.collections.flatMap((c) => c.categories)];
  return slugs.map((slug) => {
    const found = all.find((c) => c.slug === slug);
    if (!found) throw new Error(`нет категории «${slug}»`);
    return found.id;
  });
}

async function main() {
  const categoryIds = await categoryIdsBySlug("animals", "food", "jobs");

  const game = await api<Game>("/api/games", {
    method: "POST",
    body: JSON.stringify({
      format: "TRIO",
      displayName: "SmokeTrio",
      settings: { roundTime: 60, winScore: 0, penaltySkip: false, categoryIds },
      teams: NAMES.map((name) => ({ name, players: [{ name }] })),
    }),
  });
  assert(game.format === "TRIO", "партия создана в формате TRIO");
  assert(game.teams.length === 3, "три команды по одному человеку");
  console.log(`[smoke-trio] game=${game.id}`);

  // Шесть ходов круга.
  const played: { turn: number; explainer: string; guesser: string; earned: number }[] = [];
  for (let step = 0; step < 6; step++) {
    const g = await api<Game>(`/api/games/${game.id}`);
    assert(g.trioTurn === step, `ход ${step + 1}: счётчик круга = ${step}`);

    const explainer = g.teams.find((t) => t.order === g.currentTeamIndex)!;
    const words = await api<{ id: number; text: string }[]>(`/api/games/${game.id}/words`);
    const guessed = GUESSED_PER_ROUND[step];

    const res = await api<{ scores: { id: number; score: number }[]; gameFinished: boolean }>(
      `/api/games/${game.id}/rounds`,
      {
        method: "POST",
        body: JSON.stringify({
          teamId: explainer.id,
          playerName: explainer.players[0].name,
          words: words.slice(0, guessed).map((w, i) => ({ wordId: w.id, guessed: true, order: i })),
        }),
      },
    );
    assert(res.scores.length === 2, `ход ${step + 1}: очки начислены двоим, а не одному`);
    const partnerId = res.scores.find((s) => s.id !== explainer.id)!.id;
    played.push({
      turn: step,
      explainer: explainer.name,
      guesser: g.teams.find((t) => t.id === partnerId)!.name,
      earned: guessed,
    });
  }

  console.log("\n  круг:");
  for (const p of played) {
    console.log(`   ход ${p.turn + 1}: ${p.explainer} → ${p.guesser} (+${p.earned} обоим)`);
  }
  console.log("");

  // ─── Инварианты круга ───
  const pairs = played.map((p) => `${p.explainer}->${p.guesser}`);
  assert(new Set(pairs).size === 6, "все шесть пар «кто кому» встретились ровно по разу");
  for (const name of NAMES) {
    const told = played.filter((p) => p.explainer === name).map((p) => p.guesser).sort();
    const heard = played.filter((p) => p.guesser === name).map((p) => p.explainer).sort();
    const others = NAMES.filter((n) => n !== name).sort();
    assert(JSON.stringify(told) === JSON.stringify(others), `${name} рассказал обоим`);
    assert(JSON.stringify(heard) === JSON.stringify(others), `${name} поугадывал у обоих`);
  }

  // Счёт: каждому — сумма тех четырёх ходов, где он играл.
  const final = await api<Game>(`/api/games/${game.id}`);
  for (const name of NAMES) {
    const expected = played
      .filter((p) => p.explainer === name || p.guesser === name)
      .reduce((s, p) => s + p.earned, 0);
    const actual = final.teams.find((t) => t.name === name)!.score;
    assert(actual === expected, `${name}: счёт ${actual} = сумма своих четырёх ходов (${expected})`);
  }
  assert(final.trioTurn === 0, "после шестого хода круг замкнулся");
  assert(final.currentRoundNumber === 2, "номер круга вырос только один раз");

  console.log("\n[smoke-trio] круг пройден целиком, все проверки зелёные");
}

main().catch((e) => {
  console.error(`\n[smoke-trio] ${(e as Error).message}`);
  process.exit(1);
});
