// Плашку с репликой ведущего рисует каждый экран сам.
//
// Так вышло не от хорошей жизни: футеры у экранов от нуля (у зрителей список
// идёт до края) до ~224 px (раздача ролей с тремя кнопками), и накладка с
// общим отступом неизбежно ложилась на кнопки то на одном экране, то на
// другом. В потоке перед футером она сжимает контент и кнопок не двигает.
//
// Цена решения — экран можно забыть, и тогда стол молча останется без
// субтитров. Этот тест и есть страховка от забывчивости: он читает исходники,
// потому что отрисовать каждый экран потребовало бы полного MafiaView.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = new URL("../src/components/mafia/", import.meta.url);
const read = (file: string) => readFileSync(fileURLToPath(new URL(file, dir)), "utf8");

const SCREENS = [
  "Announce.tsx", // утро, итог голосования, последнее слово, «ты выбыл»
  "RoleReveal.tsx",
  "FinaleScreen.tsx",
  "SpectatorScreen.tsx",
  "DayScreens.tsx", // обсуждение и голосование
  "NightScreen.tsx",
];

describe("плашка стоит на каждом экране", () => {
  it.each(SCREENS)("%s рисует NarrationCaption", (file) => {
    expect(read(file)).toContain("<NarrationCaption />");
  });

  it("оболочка её больше не рисует — иначе задвоится", () => {
    expect(read("MafiaShell.tsx")).not.toContain("NarrationCaption");
  });
});
