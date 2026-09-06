// Реплики ведущего: что сайт произносит вслух за одним столом.
//
// Текст сочиняет СЕРВЕР и один и тот же для всех. Иначе всплывает утечка:
// озвучивает устройство хоста, а хост может быть мёртв — его персональный
// MafiaView содержит все роли, и фраза, собранная из такого вида, зачитала бы
// их вслух на весь стол. Здесь на входе только снапшот, и наружу идут ровно те
// факты, которые и так публичны.
//
// Все глаголы в настоящем времени («погибает», «выбывает», «побеждает») —
// они не имеют рода, а пола игрока мы не знаем.

import type {
  MafiaSnapshot,
  MafiaRole,
  MafiaWinner,
  MafiaNightStepRole,
} from "./mafia";

export interface MafiaNarration {
  /** Клиент произносит текст, когда ключ сменился. */
  key: string;
  text: string;
}

const ROLE_WORD: Record<MafiaRole, string> = {
  mafia: "мафия",
  don: "дон",
  sheriff: "шериф",
  doctor: "доктор",
  maniac: "маньяк",
  civilian: "мирный житель",
};

const WINNER_WORD: Record<MafiaWinner, string> = {
  city: "город",
  mafia: "мафия",
  maniac: "маньяк",
};

/** Вызов роли ночью. Фразы «роль засыпает» нет: её заменяет вызов следующей. */
const STEP_CALL: Record<MafiaNightStepRole, string> = {
  sleep: "Город засыпает. Все закрывают глаза.",
  mafia: "Просыпается мафия. Мафия, выберите жертву.",
  doctor: "Просыпается доктор. Доктор, кого будешь лечить?",
  sheriff: "Просыпается шериф. Шериф, кого проверишь?",
  maniac: "Просыпается маньяк. Маньяк, выбери жертву.",
};

function plural(n: number, forms: [string, string, string]): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/** «две минуты», «полторы минуты», «сорок пять секунд» — словами счёт не пишем. */
export function humanDuration(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) {
    const m = seconds / 60;
    if (m === 1) return "одна минута";
    if (m === 2) return "две минуты";
    return `${m} ${plural(m, ["минута", "минуты", "минут"])}`;
  }
  return `${seconds} ${plural(seconds, ["секунда", "секунды", "секунд"])}`;
}

/** «Максим», «Максим и Аня», «Максим, Аня и Игорь». */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} и ${names[names.length - 1]}`;
}

function nameOf(s: MafiaSnapshot, userId: string | undefined): string | null {
  if (!userId) return null;
  return s.players.find((p) => p.userId === userId)?.displayName ?? null;
}

/** Итоги ночи вслух. Роль погибшего — только если её и так раскрывает правило. */
function morningText(s: MafiaSnapshot): string {
  const fallen = s.deaths.filter((d) => d.day === s.day && d.by !== "vote");
  const head = "Наступает утро. Город просыпается.";
  if (fallen.length === 0) return `${head} Этой ночью все выжили.`;

  const verb = fallen.length === 1 ? "погибает" : "погибают";
  const parts = [`${head} Этой ночью ${verb} ${listNames(fallen.map((d) => d.displayName))}.`];
  if (s.settings.rules.revealRoles) {
    for (const d of fallen) parts.push(`${d.displayName} — ${ROLE_WORD[d.role]}.`);
  }
  return parts.join(" ");
}

function voteText(s: MafiaSnapshot): string {
  if (s.vote.round === 2) {
    const names = (s.vote.leaders ?? [])
      .map((id) => nameOf(s, id))
      .filter((n): n is string => Boolean(n));
    // Именительный падеж вместо «между Максимом и Аней»: имена не склоняем.
    return names.length > 0
      ? `Переголосование. Кандидаты: ${names.join(", ")}.`
      : "Переголосование.";
  }
  return "Начинается голосование. Выберите, кого изгнать из города.";
}

function voteResultText(s: MafiaSnapshot): string {
  const name = nameOf(s, s.vote.eliminated);
  if (name) return `Голосование окончено. Из игры выбывает ${name}.`;
  return s.vote.round === 2
    ? "Голоса разделились. Никто не выбывает."
    : "Голоса разделились.";
}

/**
 * Что произнести прямо сейчас. Возвращает undefined, когда ведущему говорить
 * нечего: обычный режим, пауза, окно хода или тишина после него.
 */
export function narrationFor(s: MafiaSnapshot): MafiaNarration | undefined {
  if (!s.settings.narrator) return undefined;

  const epoch = s.narrationEpoch ?? 0;
  const key = (...parts: (string | number)[]) =>
    [epoch, s.day, s.phase, ...parts].join(":");

  switch (s.phase) {
    case "ROLE_REVEAL":
      return {
        key: key(),
        text: "Роли розданы. Посмотрите свою роль и подтвердите, что запомнили.",
      };

    case "NIGHT": {
      const step = s.night.step;
      // Говорим только в момент вызова: в окне хода и в тишине после него
      // ведущий молчит.
      if (!step || step.stage !== "announce") return undefined;
      return { key: key(step.index, step.role), text: STEP_CALL[step.role] };
    }

    case "MORNING":
      return { key: key(), text: morningText(s) };

    case "DISCUSSION":
      return {
        key: key(),
        text: `Обсуждение. У вас ${humanDuration(s.settings.timers.discussion)}.`,
      };

    case "VOTE":
      return { key: key(s.vote.round), text: voteText(s) };

    case "VOTE_RESULT":
      return { key: key(s.vote.round), text: voteResultText(s) };

    case "LAST_WORD": {
      const name = nameOf(s, s.pendingElim);
      return {
        key: key(),
        text: name ? `Последнее слово, ${name}.` : "Последнее слово.",
      };
    }

    case "FINISHED":
      return {
        key: key(),
        text: s.winner
          ? `Игра окончена. Побеждает ${WINNER_WORD[s.winner]}.`
          : "Игра окончена.",
      };

    default:
      return undefined;
  }
}
