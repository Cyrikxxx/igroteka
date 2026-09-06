// Хук комнаты Мафии: живой остаток фазы и различение «связь моргнула» и
// «комнаты больше нет».

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { MafiaView } from "@alias/shared/mafia";
import { FakeSocket } from "./helpers/fake-socket";

const holder = vi.hoisted(() => ({ socket: null as unknown }));

vi.mock("@/lib/socket-client", () => ({
  connectToRoom: () => holder.socket,
  disconnectRoom: vi.fn(),
}));

import { useMafiaRoom } from "@/hooks/useMafiaRoom";

const OPTS = { wsUrl: "http://ws", token: "t", code: "ABCDEF", name: "Аня" };

function view(over: Partial<MafiaView> = {}): MafiaView {
  return {
    code: "ABCDEF",
    title: null,
    hostId: "host",
    phase: "NIGHT",
    day: 1,
    settings: {},
    players: [],
    spectatorCount: 0,
    readyCount: 0,
    aliveCount: 5,
    you: { userId: "host", isHost: true, alive: true, ready: false, role: null },
    deaths: [],
    ...over,
  } as unknown as MafiaView;
}

let sock: FakeSocket;
beforeEach(() => {
  sock = new FakeSocket();
  holder.socket = sock;
});

function mount(initial: MafiaView) {
  const rendered = renderHook(() => useMafiaRoom(OPTS));
  act(() => {
    sock.reply("mafia:hello", initial);
  });
  return rendered;
}

describe("useMafiaRoom", () => {
  it("при входе здоровается и забирает состояние", () => {
    const { result } = mount(view());
    expect(sock.lastSent("mafia:hello")).toBeDefined();
    expect(result.current.view?.phase).toBe("NIGHT");
  });

  it("тик двигает остаток фазы", () => {
    // Экраны фаз показывают именно этот остаток. Пока его никто не брал из
    // хука, таймер на экране стоял на месте — цифра менялась только с
    // приходом нового состояния комнаты.
    const { result } = mount(view({ timer: { msLeft: 60_000, paused: false } }));
    expect(result.current.timer?.msLeft).toBe(60_000);

    act(() => {
      sock.server("mafia:tick", { msLeft: 57_000, paused: false });
    });
    expect(result.current.timer?.msLeft).toBe(57_000);
  });

  it("между тиками остаток убывает сам", () => {
    vi.useFakeTimers();
    try {
      const { result } = mount(view({ timer: { msLeft: 60_000, paused: false } }));
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current.timer!.msLeft).toBeLessThan(60_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("на паузе остаток не тает", () => {
    vi.useFakeTimers();
    try {
      const { result } = mount(view({ timer: { msLeft: 42_000, paused: true } }));
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(result.current.timer!.msLeft).toBe(42_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("обрыв связи — это не «комнаты больше нет»", () => {
    const { result } = mount(view());
    act(() => {
      sock.server("disconnect", "transport close");
    });
    expect(result.current.closedReason).toBeNull();
  });

  it("а вот mafia:closed — это оно и есть", () => {
    const { result } = mount(view());
    act(() => {
      sock.server("mafia:closed", { reason: "kicked" });
    });
    expect(result.current.closedReason).toMatch(/выгнал/i);
  });
});
