// Хук комнаты Алиаса. Здесь живёт вся логика состояния раунда, и именно тут
// был баг, из-за которого вернувшийся объясняющий не мог играть: флаг паузы
// поднимался при входе и больше никогда не опускался, а на нём завязаны и
// предупреждение, и блокировка кнопок «угадал / пропустить».

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { RoomSnapshot } from "@igroteka/shared/alias";
import { FakeSocket } from "./helpers/fake-socket";

// Держатель: vi.mock поднимается наверх файла, поэтому сокет подставляем
// через объект, который заполняем уже в beforeEach.
const holder = vi.hoisted(() => ({ socket: null as unknown }));

vi.mock("@/lib/socket-client", () => ({
  connectToRoom: () => holder.socket,
  disconnectRoom: vi.fn(),
}));

import { useRoom } from "@/hooks/useRoom";

const OPTS = { wsUrl: "http://ws", token: "t", code: "ABCDEF" };

function snapshot(over: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    code: "ABCDEF",
    title: null,
    status: "IN_GAME",
    hostId: "host",
    settings: { roundTime: 60, winScore: 50, penaltySkip: false, categoryIds: [1] },
    phase: "ROUND_ACTIVE",
    currentTeamId: 1,
    currentPlayerId: "host",
    currentRoundNumber: 1,
    teams: [],
    spectators: [],
    timer: null,
    scoreboard: null,
    gameId: "g1",
    ...over,
  } as RoomSnapshot;
}

/** Таймер раунда в том виде, в каком его рассылает сервер. */
function timer(msLeft: number, paused: boolean) {
  return { msLeft, paused, endsAt: paused ? null : Date.now() + msLeft, durationMs: 60_000 };
}

let sock: FakeSocket;
beforeEach(() => {
  sock = new FakeSocket();
  holder.socket = sock;
});

/** Смонтировать хук и отдать ему снапшот в ответ на room:hello. */
function mount(initial: RoomSnapshot) {
  const view = renderHook(() => useRoom(OPTS));
  act(() => {
    sock.reply("room:hello", initial);
  });
  return view;
}

describe("useRoom", () => {
  it("при входе здоровается и забирает снапшот", () => {
    const { result } = mount(snapshot());
    expect(sock.lastSent("room:hello")).toBeDefined();
    expect(result.current.snapshot?.code).toBe("ABCDEF");
  });

  it("отправка работает сразу после монтирования", () => {
    // Скрытый дефект: хук отдавал сокет через ref, а чтение ref при рендере
    // не вызывает перерисовку. Потребитель получал null на первом рендере и
    // оживал только потому, что его перерисовывало что-то другое — приход
    // снапшота. Нажатие в первые мгновения молча не доходило до сервера.
    const { result } = renderHook(() => useRoom(OPTS));
    act(() => {
      result.current.emit("room:leave", {});
    });
    expect(sock.lastSent("room:leave")).toBeDefined();
  });

  it("вошёл в комнату на паузе — пауза видна", () => {
    const { result } = mount(snapshot({ timer: timer(30_000, true) }));
    expect(result.current.tick?.paused).toBe(true);
  });

  it("пришёл тик — пауза снята, даже если входили на паузе", () => {
    // Это и есть регрессия. Сервер не шлёт тики, пока раунд стоит, поэтому
    // сам факт тика означает «время снова идёт». Раньше сюда протаскивалось
    // прежнее значение флага, и он оставался поднятым навсегда: кнопки
    // «угадал / пропустить» так и не оживали.
    const { result } = mount(snapshot({ timer: timer(30_000, true) }));
    expect(result.current.tick?.paused).toBe(true);

    act(() => {
      sock.server("round:tick", { msLeft: 29_000 });
    });
    expect(result.current.tick?.paused).toBe(false);
    expect(result.current.tick?.msLeft).toBe(29_000);
  });

  it("рассылка состояния доезжает до потребителя", () => {
    const { result } = mount(snapshot({ timer: timer(30_000, true) }));
    act(() => {
      sock.server("room:state", snapshot({ timer: timer(28_000, false) }));
    });
    expect(result.current.snapshot?.timer?.paused).toBe(false);
  });

  it("объясняющему приходит слово", () => {
    const { result } = mount(snapshot());
    act(() => {
      sock.server("round:word", { wordId: 7, text: "маяк", index: 1, total: 50 });
    });
    expect(result.current.currentWord?.text).toBe("маяк");
  });

  it("обрыв связи — это не «комнаты больше нет»", () => {
    // По closedReason страницы выкидывают человека на главный экран. Ставить
    // его на любом разрыве нельзя: связь ещё может вернуться.
    const { result } = mount(snapshot());
    act(() => {
      sock.server("disconnect", "transport close");
    });
    expect(result.current.closedReason).toBeNull();
    expect(result.current.status).toBe("reconnecting");
  });

  it("а вот room:closed — это оно и есть", () => {
    const { result } = mount(snapshot());
    act(() => {
      sock.server("room:closed", { reason: "kicked" });
    });
    expect(result.current.closedReason).toMatch(/выгнал|удалил/i);
    expect(result.current.status).toBe("closed");
  });
});

// Из-за этой гонки за столом пропадала кнопка «Подтвердить · передать ход».
// Дебаунсенная рассылка на сервере читает снимок из Redis, а отправляет уже
// после — и в промежуток успевает лечь новая фаза. Снимок «из прошлого»
// прилетал вдогонку и стирал уже пришедшие итоги раунда; следующего снимка
// можно было ждать до чьего-нибудь переподключения.
describe("устаревшие снимки", () => {
  const REVIEW = {
    teamId: 1,
    words: [{ wordId: 1, text: "маяк", guessed: true, order: 1 }],
    scorePreview: 1,
  };

  it("снимок со старой ревизией не применяется", () => {
    const { result } = mount(snapshot({ rev: 5, currentRoundNumber: 5 }));
    act(() => {
      sock.server("room:state", snapshot({ rev: 4, currentRoundNumber: 4 }));
    });
    expect(result.current.snapshot?.currentRoundNumber).toBe(5);
  });

  it("снимок с новой ревизией применяется", () => {
    const { result } = mount(snapshot({ rev: 5, currentRoundNumber: 5 }));
    act(() => {
      sock.server("room:state", snapshot({ rev: 6, currentRoundNumber: 6 }));
    });
    expect(result.current.snapshot?.currentRoundNumber).toBe(6);
  });

  it("опоздавший снимок с прежней фазой не гасит итоги раунда", () => {
    const { result } = mount(snapshot({ rev: 1 }));
    act(() => {
      sock.server("round:phase", { phase: "ROUND_REVIEW" });
      sock.server("round:review", REVIEW);
    });
    expect(result.current.review).not.toBeNull();

    act(() => {
      // Ревизия НОВЕЕ — снимок применяется, фильтр его не отсекает. Проверяем
      // именно второй замок: итоги гасит переход фазы, а не содержимое снимка.
      sock.server("room:state", snapshot({ rev: 2, phase: "ROUND_ACTIVE" }));
    });
    expect(result.current.snapshot?.phase).toBe("ROUND_ACTIVE");
    expect(result.current.review).not.toBeNull();
  });

  it("итоги гасит переход фазы, а не снимок", () => {
    const { result } = mount(snapshot({ rev: 1 }));
    act(() => {
      sock.server("round:phase", { phase: "ROUND_REVIEW" });
      sock.server("round:review", REVIEW);
    });
    expect(result.current.review).not.toBeNull();

    act(() => {
      sock.server("round:phase", { phase: "PRE_ROUND" });
    });
    expect(result.current.review).toBeNull();
  });

  it("у комнат без ревизии снимки проходят как раньше", () => {
    // Комнаты, созданные до появления поля, лежат в Redis без него — если бы
    // фильтр их отбрасывал, первый же живой стол после выката перестал бы
    // получать состояние вовсе.
    const { result } = mount(snapshot({ currentRoundNumber: 1 }));
    act(() => {
      sock.server("room:state", snapshot({ currentRoundNumber: 2 }));
    });
    expect(result.current.snapshot?.currentRoundNumber).toBe(2);
  });
});
