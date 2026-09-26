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

/** Вызов роли ночью. Парная ей фраза засыпания — в STEP_SLEEP. */
const STEP_CALL: Record<MafiaNightStepRole, string> = {
  sleep: "Город засыпает. Все закрывают глаза.",
  mafia: "Просыпается мафия. Мафия, выберите жертву.",
  doctor: "Просыпается доктор. Доктор, кого будешь лечить?",
  sheriff: "Просыпается шериф. Шериф, кого проверишь?",
  maniac: "Просыпается маньяк. Маньяк, выбери жертву.",
};

/**
 * Роль закрывает глаза. Звучит в паузе после её хода — стадии gap.
 *
 * У общей команды «Город засыпает» пары нет: она никого не будила, и будить
 * обратно некого. Тип это и фиксирует.
 */
const STEP_SLEEP: Record<Exclude<MafiaNightStepRole, "sleep">, string> = {
  mafia: "Мафия засыпает.",
  doctor: "Доктор засыпает.",
  sheriff: "Шериф засыпает.",
  maniac: "Маньяк засыпает.",
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

// ─────────── Сколько звучит реплика ───────────
//
// Фазу двигает таймер сервера, а произносит текст браузер игрока. Если фраза
// длиннее окна фазы, следующая реплика обрывает её на полуслове: speak()
// начинает с cancel(). Сервер сам сочиняет текст — он же и прикидывает, сколько
// текст звучит, и не закрывает фазу раньше времени.
//
// Числа подбирались на слух на синтезе с rate 0.95 — калибровать здесь.

/** Символов в секунду. */
const SPEECH_CPS = 14;
/** Пока голос раскачается. */
const SPEECH_LEAD_MS = 400;
/** Пауза на точке. */
const SPEECH_SENTENCE_MS = 250;
/** Тишина после последнего слова, чтобы фраза не упиралась в следующую. */
const SPEECH_TAIL_MS = 500;
/** Потолок: длиннее любой реплики, которую способен собрать narrationFor. */
const SPEECH_MAX_MS = 20000;

/**
 * Сколько примерно звучит текст.
 *
 * Цифра весит один символ, а читается словом («45 секунд» — это «сорок пять
 * секунд»), поэтому считается за четыре.
 */
export function speechMs(text: string): number {
  const digits = text.match(/\d/g)?.length ?? 0;
  const sentences = text.match(/[.!?]/g)?.length ?? 0;
  const weighted = text.length + digits * 3;
  const ms =
    SPEECH_LEAD_MS + (weighted / SPEECH_CPS) * 1000 + sentences * SPEECH_SENTENCE_MS;
  return Math.min(Math.round(ms), SPEECH_MAX_MS);
}

/**
 * Пол длительности фазы: не короче базового окна и не короче реплики, которая
 * в этой фазе звучит.
 *
 * Реплики нет — в том числе когда ведущий выключен вовсе, — и база возвращается
 * как есть: партия без ведущего идёт ровно теми же таймерами, что и раньше.
 */
export function narrationMinMs(s: MafiaSnapshot, baseMs: number): number {
  const narration = narrationFor(s);
  if (!narration) return baseMs;
  return Math.max(baseMs, speechMs(narration.text) + SPEECH_TAIL_MS);
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
  if (s.vote.skipped) return "Город решил никого не изгонять.";
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
      if (!step) return undefined;
      // Вызов роли и её засыпание — две реплики одного шага, и ключи у них
      // обязаны различаться: клиент говорит по смене ключа, и на совпавшем
      // вторая фраза была бы проглочена.
      if (step.stage === "announce") {
        return {
          key: key(step.index, step.role, "call"),
          text: STEP_CALL[step.role],
        };
      }
      if (step.stage === "gap" && step.role !== "sleep") {
        return {
          key: key(step.index, step.role, "sleep"),
          text: STEP_SLEEP[step.role],
        };
      }
      // В окне хода ведущий молчит.
      return undefined;
    }

    case "MORNING":
      return { key: key(), text: morningText(s) };

    case "DISCUSSION":
      // День 0 — знакомство до первой ночи: изгонять в нём некого, и обещать
      // голосование в конце было бы враньём.
      return {
        key: key(),
        text:
          s.day === 0
            ? `Знакомство. У вас ${humanDuration(s.settings.timers.discussion)}, чтобы поговорить. Этим днём никого не изгоняют.`
            : `Обсуждение. У вас ${humanDuration(s.settings.timers.discussion)}.`,
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
