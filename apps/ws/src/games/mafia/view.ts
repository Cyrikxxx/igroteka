// Построение ПЕРСОНАЛЬНОГО вида MafiaView из полного снапшота.
// Здесь живёт вся приватность: свою роль видишь, чужие — нет; ночные
// цели/результаты шерифа уходят только тому, кому положено.

import type {
  MafiaSnapshot,
  MafiaView,
  MafiaPlayerView,
  MafiaYouView,
  MafiaVoteView,
  MafiaPlayerFull,
  MafiaDeathView,
  MafiaRole,
  MafiaNightStep,
} from "@alias/shared/mafia";
import { roleTeam } from "@alias/shared/mafia";
import { narrationFor } from "@alias/shared/mafia-narration";

function findSelf(
  snap: MafiaSnapshot,
  userId: string,
): { p: MafiaPlayerFull; isSpectator: boolean } | null {
  const player = snap.players.find((x) => x.userId === userId);
  if (player) return { p: player, isSpectator: false };
  const spec = snap.spectators.find((x) => x.userId === userId);
  if (spec) return { p: spec, isSpectator: true };
  return null;
}

function timerView(snap: MafiaSnapshot): MafiaView["timer"] {
  // На паузе показываем замороженный остаток, а не обратный отсчёт от
  // старого дедлайна — иначе таймер продолжал бы «таять» на экране.
  if (snap.timerPaused && snap.timerRemainingMs != null) {
    return { msLeft: snap.timerRemainingMs, paused: true };
  }
  if (!snap.timerEndsAt) return undefined;
  const msLeft = Math.max(0, snap.timerEndsAt - Date.now());
  return { msLeft, paused: Boolean(snap.timerPaused) };
}

/** Зовёт ли этот шаг именно эту роль. Шаг мафии зовёт и дона. */
function stepCalls(step: MafiaNightStep, role: MafiaRole): boolean {
  if (step.role === "mafia") return role === "mafia" || role === "don";
  return step.role === role;
}

export function buildView(snap: MafiaSnapshot, userId: string): MafiaView {
  const self = findSelf(snap, userId);
  const selfP = self?.p ?? null;
  const isSpectator = self?.isSpectator ?? true;
  const selfDead = selfP ? !selfP.alive : true;

  const finished = snap.phase === "FINISHED";
  // Кто видит все роли: финал, либо мёртвый/зритель при включённом правиле.
  const seeAll =
    finished ||
    ((selfDead || isSpectator) && snap.settings.rules.spectatorsSeeRoles);

  const reveal = snap.settings.rules.revealRoles;

  const players: MafiaPlayerView[] = snap.players.map((p) => {
    const showRole =
      seeAll ||
      (selfP && p.userId === selfP.userId) ||
      (!p.alive && reveal) ||
      finished;
    return {
      userId: p.userId,
      displayName: p.displayName,
      avatarIdx: p.avatarIdx,
      order: p.order,
      online: p.online,
      alive: p.alive,
      isHost: p.isHost,
      ready: p.ready,
      role: showRole && p.role ? p.role : undefined,
      eliminatedBy: p.eliminatedBy,
      deathDay: p.deathDay,
    };
  });

  // ── you ──
  const myRole = selfP?.role ?? null;
  const you: MafiaYouView = {
    userId,
    role: myRole,
    team: myRole ? roleTeam(myRole) : null,
    alive: selfP ? selfP.alive : false,
    isHost: selfP?.isHost ?? false,
    ready: selfP?.ready ?? false,
    isSpectator,
  };

  if (myRole === "mafia" || myRole === "don") {
    const mates = snap.players.filter(
      (p) => p.userId !== userId && (p.role === "mafia" || p.role === "don"),
    );
    you.partners = mates.map((p) => p.displayName);
    you.partnerIds = mates.map((p) => p.userId);
    you.mafiaVotes = snap.night.mafiaVotes;
    you.nightTarget = snap.night.mafiaVotes[userId];
  } else if (myRole === "doctor") {
    you.nightTarget = snap.night.doctorTarget;
    you.doctorPrevTarget = snap.night.doctorPrevTarget;
    you.doctorSelfHealUsed = snap.night.doctorSelfHealUsed;
  } else if (myRole === "sheriff") {
    you.nightTarget = snap.night.sheriffTarget;
    you.sheriffResults = snap.night.sheriffResults;
  } else if (myRole === "maniac") {
    you.nightTarget = snap.night.maniacTarget;
  }

  if (snap.vote.votes[userId]) you.voted = snap.vote.votes[userId];

  // ── vote view ──
  let vote: MafiaVoteView | undefined;
  if (
    snap.phase === "VOTE" ||
    snap.phase === "VOTE_RESULT" ||
    snap.phase === "LAST_WORD"
  ) {
    const aliveIds = snap.players.filter((p) => p.alive).map((p) => p.userId);
    const showTally =
      snap.settings.rules.openVotes ||
      seeAll ||
      snap.phase === "VOTE_RESULT" ||
      snap.phase === "LAST_WORD";
    let tally: Record<string, number> | undefined;
    if (showTally) {
      tally = {};
      for (const target of Object.values(snap.vote.votes)) {
        if (target === "abstain") continue;
        tally[target] = (tally[target] ?? 0) + 1;
      }
    }
    vote = {
      round: snap.vote.round,
      tally,
      totalVoters: aliveIds.length,
      votedCount: Object.keys(snap.vote.votes).length,
      leaders: snap.vote.leaders,
      eliminated: snap.vote.eliminated,
      tie: snap.vote.tie,
    };
  }

  // ── список смертей ──
  // Роль погибшего — такой же секрет, как и роль живого: отдаём её только
  // когда правила раскрывают роли или смотрящий и так видит всё.
  const deaths: MafiaDeathView[] = snap.deaths.map((d) => ({
    userId: d.userId,
    displayName: d.displayName,
    day: d.day,
    by: d.by,
    ...(reveal || seeAll ? { role: d.role } : {}),
  }));

  // ── spotlight (для MORNING / VOTE_RESULT / LAST_WORD) ──
  const avatarOf = (userId: string) =>
    snap.players.find((p) => p.userId === userId)?.avatarIdx ?? 0;

  let spotlight: MafiaView["spotlight"];
  if (snap.phase === "MORNING") {
    // Все, кто не пережил эту ночь: мафия и маньяк могут сработать порознь.
    const nightDeaths = snap.deaths.filter(
      (d) => d.day === snap.day && d.by !== "vote",
    );
    if (nightDeaths.length > 0) {
      spotlight = nightDeaths.map((d) => ({
        userId: d.userId,
        displayName: d.displayName,
        avatarIdx: avatarOf(d.userId),
        role: reveal || seeAll ? d.role : undefined,
        cause: d.by,
      }));
    }
  } else if (snap.phase === "VOTE_RESULT" || snap.phase === "LAST_WORD") {
    const targetId = snap.vote.eliminated ?? snap.pendingElim;
    const target = snap.players.find((p) => p.userId === targetId);
    if (target) {
      spotlight = [
        {
          userId: target.userId,
          displayName: target.displayName,
          avatarIdx: target.avatarIdx,
          role: (reveal || seeAll) && target.role ? target.role : undefined,
          cause: "vote",
        },
      ];
    }
  }

  // ── ночь по шагам (режим ведущего) ──
  const step =
    snap.phase === "NIGHT" && snap.settings.narrator ? snap.night.step : undefined;
  const yourTurn = Boolean(
    step && selfP && selfP.alive && !isSpectator && myRole && stepCalls(step, myRole),
  );

  // Длина шага — сама по себе секрет: у мёртвой роли она случайная, и общий
  // обратный отсчёт выдал бы её всему столу. Поэтому ночью остаток видит
  // только тот, чей сейчас ход. (Тики на это время сервер тоже не шлёт.)
  const timer = step && !yourTurn ? undefined : timerView(snap);

  return {
    code: snap.code,
    title: snap.title,
    hostId: snap.hostId,
    phase: snap.phase,
    day: snap.day,
    settings: snap.settings,
    players,
    spectatorCount: snap.spectators.length,
    readyCount: snap.players.filter((p) => p.ready).length,
    aliveCount: snap.players.filter((p) => p.alive).length,
    you,
    vote,
    winner: snap.winner,
    deaths,
    // Журнал раскрывает роли и проверки шерифа — живому игроку нельзя.
    events: seeAll ? (snap.events ?? []) : undefined,
    timer,
    paused: Boolean(snap.timerPaused),
    night: step ? { step: step.role, stage: step.stage, yourTurn } : undefined,
    // Реплику ведущего строим из снапшота: она одинакова для всех и содержит
    // только публичные факты. Собери её клиент из своего вида — устройство
    // мёртвого хоста зачитало бы вслух все роли, которые ему видны.
    narration: narrationFor(snap),
    spotlight,
    banned: you.isHost ? (snap.banned ?? []) : undefined,
    // Видно всем: по этой отметке остальные рисуют «взять комнату на себя».
    hostOfflineSince: snap.hostOfflineSince ?? null,
  };
}
