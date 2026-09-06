// Хук комнаты Алиаса. Здесь живёт вся логика состояния раунда, и именно тут
// был баг, из-за которого вернувшийся объясняющий не мог играть: флаг паузы
// поднимался при входе и больше никогда не опускался, а на нём завязаны и
// предупреждение, и блокировка кнопок «угадал / пропустить».

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { RoomSnapshot } from "@alias/shared/domain";
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

  it("вошёл в комнату на паузе — пауза видна", () => {
    const { result } = mount(snapshot({ timer: { msLeft: 30_000, paused: true } }));
    expect(result.current.tick?.paused).toBe(true);
  });

  it("пришёл тик — пауза снята, даже если входили на паузе", () => {
    // Это и есть регрессия. Сервер не шлёт тики, пока раунд стоит, поэтому
    // сам факт тика означает «время снова идёт». Раньше сюда протаскивалось
    // прежнее значение флага, и он оставался поднятым навсегда: кнопки
    // «угадал / пропустить» так и не оживали.
    const { result } = mount(snapshot({ timer: { msLeft: 30_000, paused: true } }));
    expect(result.current.tick?.paused).toBe(true);

    act(() => {
      sock.server("round:tick", { msLeft: 29_000 });
    });
    expect(result.current.tick?.paused).toBe(false);
    expect(result.current.tick?.msLeft).toBe(29_000);
  });

  it("рассылка состояния доезжает до потребителя", () => {
    const { result } = mount(snapshot({ timer: { msLeft: 30_000, paused: true } }));
    act(() => {
      sock.server("room:state", snapshot({ timer: { msLeft: 28_000, paused: false } }));
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
