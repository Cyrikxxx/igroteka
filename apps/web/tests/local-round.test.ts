// Черновик незавершённого раунда локальной игры.
//
// До него перезагрузка вкладки посреди раунда стирала всё: возвращался новый
// набор слов и полный таймер. Тест держит формат записи и её проверку.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { saveRound, loadRound, clearRound } from "../src/lib/local-round";
import type { WordInRound } from "../src/types";

const words: WordInRound[] = [
  { wordId: 1, text: "маяк", guessed: true, order: 0 },
  { wordId: 2, text: "жираф", guessed: false, order: 1 },
  { wordId: 3, text: "космос", guessed: null, order: 2 },
];

const draft = {
  words,
  currentIndex: 2,
  phase: "active" as const,
  countdown: { endsAt: 1_700_000_060_000, remainingMs: 60_000 },
};

/** localStorage в node-окружении нет — подсовываем простую замену. */
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

describe("черновик раунда", () => {
  it("сохранённый раунд возвращается целиком", () => {
    saveRound("g1", draft);
    const back = loadRound("g1");
    expect(back?.words).toEqual(words);
    expect(back?.currentIndex).toBe(2);
    expect(back?.phase).toBe("active");
    expect(back?.countdown.endsAt).toBe(1_700_000_060_000);
  });

  it("у каждой партии свой черновик", () => {
    saveRound("g1", draft);
    expect(loadRound("g2")).toBeNull();
  });

  it("после очистки ничего не остаётся", () => {
    saveRound("g1", draft);
    clearRound("g1");
    expect(loadRound("g1")).toBeNull();
  });

  it("запись другой версии отбрасывается, а не ломает игру", () => {
    localStorage.setItem("alias.localRound.g1", JSON.stringify({ ...draft, v: 99 }));
    expect(loadRound("g1")).toBeNull();
  });

  it("испорченная запись отбрасывается", () => {
    localStorage.setItem("alias.localRound.g1", "{это не json");
    expect(loadRound("g1")).toBeNull();
  });

  it("запись без слов бесполезна и не восстанавливается", () => {
    localStorage.setItem(
      "alias.localRound.g1",
      JSON.stringify({ ...draft, v: 1, words: [] }),
    );
    expect(loadRound("g1")).toBeNull();
  });

  it("недоступное хранилище не роняет игру", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("приватный режим");
      },
      setItem: () => {
        throw new Error("переполнено");
      },
      removeItem: () => {},
    });
    expect(() => saveRound("g1", draft)).not.toThrow();
    expect(loadRound("g1")).toBeNull();
  });
});
