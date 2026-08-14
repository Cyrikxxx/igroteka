// Ядро таймера раунда. Часы поддельные — проверяем именно арифметику
// дедлайна, а не то, как браузер соблюдает setInterval.

import { describe, it, expect } from "vitest";
import {
  createCountdown,
  startCountdown,
  pauseCountdown,
  remainingMs,
  remainingSeconds,
  isExpired,
} from "../src/countdown";

const T0 = 1_700_000_000_000;

describe("countdown", () => {
  it("до старта показывает полную длительность и не течёт", () => {
    const c = createCountdown(60);
    expect(remainingSeconds(c, T0)).toBe(60);
    expect(remainingSeconds(c, T0 + 10_000)).toBe(60);
    expect(isExpired(c, T0 + 10_000)).toBe(false);
  });

  it("длительность не зависит от того, сколько раз мы смотрели на часы", () => {
    // Ровно это и было сломано: раньше счётчик уменьшался по одному разу
    // за тик, поэтому пропущенные тики удлиняли раунд.
    const c = startCountdown(createCountdown(60), T0);
    expect(remainingSeconds(c, T0 + 1_000)).toBe(59);
    // Вкладку свернули на 30 с — ни одного тика не случилось.
    expect(remainingSeconds(c, T0 + 31_000)).toBe(29);
    expect(remainingSeconds(c, T0 + 60_000)).toBe(0);
    expect(isExpired(c, T0 + 60_000)).toBe(true);
  });

  it("остаток не уходит в минус после дедлайна", () => {
    const c = startCountdown(createCountdown(30), T0);
    expect(remainingMs(c, T0 + 90_000)).toBe(0);
    expect(remainingSeconds(c, T0 + 90_000)).toBe(0);
  });

  it("пауза замораживает остаток, сколько бы она ни длилась", () => {
    let c = startCountdown(createCountdown(60), T0);
    c = pauseCountdown(c, T0 + 20_000);
    expect(remainingSeconds(c, T0 + 20_000)).toBe(40);
    expect(remainingSeconds(c, T0 + 300_000)).toBe(40);
  });

  it("после паузы отсчёт продолжается с того же места", () => {
    let c = startCountdown(createCountdown(60), T0);
    c = pauseCountdown(c, T0 + 20_000);
    c = startCountdown(c, T0 + 300_000); // сняли паузу спустя 4,5 минуты
    expect(remainingSeconds(c, T0 + 300_000)).toBe(40);
    expect(remainingSeconds(c, T0 + 320_000)).toBe(20);
    expect(isExpired(c, T0 + 340_000)).toBe(true);
  });

  it("несколько пауз подряд не съедают и не добавляют время", () => {
    let c = startCountdown(createCountdown(60), T0);
    let now = T0;
    for (let i = 0; i < 5; i++) {
      now += 5_000;
      c = pauseCountdown(c, now); // потратили 5 с
      now += 60_000; // стоим минуту
      c = startCountdown(c, now);
    }
    expect(remainingSeconds(c, now)).toBe(60 - 25);
  });

  it("повторный старт на ходу ничего не сдвигает", () => {
    let c = startCountdown(createCountdown(60), T0);
    c = startCountdown(c, T0 + 10_000);
    expect(remainingSeconds(c, T0 + 10_000)).toBe(50);
  });

  it("истёкший отсчёт заново не пускается", () => {
    let c = startCountdown(createCountdown(10), T0);
    c = pauseCountdown(c, T0 + 10_000);
    c = startCountdown(c, T0 + 20_000);
    expect(isExpired(c, T0 + 20_000)).toBe(true);
  });

  it("последняя секунда показывается как «1», ноль — ровно в конце", () => {
    const c = startCountdown(createCountdown(3), T0);
    expect(remainingSeconds(c, T0 + 2_001)).toBe(1);
    expect(remainingSeconds(c, T0 + 2_999)).toBe(1);
    expect(remainingSeconds(c, T0 + 3_000)).toBe(0);
  });
});
