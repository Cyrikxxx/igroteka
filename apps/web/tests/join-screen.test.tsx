// Общий экран входа по коду (/join).
//
// Проверяется то, что легко сломать незаметно: подстановка запомненного имени
// и кода из ссылки. Я уже один раз убрал подстановку вместе с эффектом и
// заметил это только чтением кода — теперь заметит тест.
//
// И главное, ради чего экран сводили в один: игру выбирает код, а не дверь.
// Раньше входов было два, и мафийный код, набранный в форме Алиаса, уходил в
// серверный вход Алиаса — тот не находил своего снимка, считал комнату
// брошенной и закрывал живую партию.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { resetNavigation, routerMock, setSearch } from "./stubs/next-navigation";

// Вход в уже знакомую комнату идёт в сеть — здесь это лишнее.
// Вернуться молча не вышло, но и «комнаты нет» сервер не сказал — экран
// входа должен показать форму кода.
vi.mock("@/lib/room-resume", () => ({
  resumeRoom: vi.fn(async () => ({ creds: null, gone: false })),
}));

vi.mock("@/lib/room-platform", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/room-platform")>()),
  resolveRoomGame: vi.fn(async () => ({ game: "alias" as const })),
}));

import { resumeRoom } from "@/lib/room-resume";
import { resolveRoomGame } from "@/lib/room-platform";
import JoinPage from "@/app/join/page";

beforeEach(() => {
  // Счётчики вызовов проверяются («сервер не спрашивали»), поэтому их надо
  // обнулять: mockResolvedValue сам по себе историю не чистит.
  vi.clearAllMocks();
  resetNavigation();
  localStorage.clear();
  setSearch("");
  vi.mocked(resolveRoomGame).mockResolvedValue({ game: "alias" });
  vi.mocked(resumeRoom).mockResolvedValue({ creds: null, gone: false });
});

function codeInput(): HTMLInputElement {
  return screen.getByLabelText("Код комнаты из шести символов") as HTMLInputElement;
}

function nameInput(): HTMLInputElement {
  return screen.getByLabelText("Твоё имя") as HTMLInputElement;
}

async function renderJoin() {
  await act(async () => {
    render(<JoinPage />);
  });
}

describe("общий вход по коду", () => {
  it("подставляет запомненное имя", async () => {
    localStorage.setItem("alias.displayName", "Аня");
    await renderJoin();
    expect(nameInput().value).toBe("Аня");
  });

  it("без запомненного имени поле пустое", async () => {
    await renderJoin();
    expect(nameInput().value).toBe("");
  });

  it("подставляет код из ссылки-приглашения", async () => {
    setSearch("code=K7F2QD");
    await renderJoin();
    expect(codeInput().value).toBe("K7F2QD");
  });

  it("код из ссылки в русской раскладке всё равно подставляется", async () => {
    // По ссылке код может приехать уже перекодированным — «отпустить» человека
    // с ошибкой было бы обидно.
    // «Л7А2ЙВ» — это K7F2QD, набранное на русской раскладке.
    setSearch("code=Л7А2ЙВ");
    await renderJoin();
    expect(codeInput().value).toBe("K7F2QD");
  });

  it("неполный код из ссылки не мешает дописать руками", async () => {
    setSearch("code=K7F");
    await renderJoin();
    expect(codeInput().value).toBe("K7F");
  });

  it("по ссылке в закрытую комнату сразу объясняет, что случилось", async () => {
    // Иначе человек введёт имя, нажмёт «Войти» и только тогда узнает, что
    // комнаты нет: форма выглядит рабочей.
    vi.mocked(resumeRoom).mockResolvedValueOnce({
      creds: null,
      gone: true,
      notice: "Эта комната уже закрыта.",
    });
    setSearch("code=K7F2QD");
    await renderJoin();
    expect(screen.getByText("Эта комната уже закрыта.")).toBeTruthy();
  });

  it("несуществующий код не притворяется освободившейся комнатой", async () => {
    // Раньше сюда приводила любая опечатка на хабе, и человек читал
    // «комнаты больше нет — код освободился» про комнату, которой не было.
    vi.mocked(resolveRoomGame).mockResolvedValueOnce({
      game: null,
      reason: "not_found",
    });
    setSearch("code=K7F2QD");
    await renderJoin();
    expect(screen.getByText("Комнаты с таким кодом нет. Проверь код.")).toBeTruthy();
    expect(resumeRoom).not.toHaveBeenCalled();
  });

  it("не выдумывает отсутствие комнаты, когда просто не смог спросить", async () => {
    // Лимит запросов или упавшая база — это не «набери код заново».
    vi.mocked(resolveRoomGame).mockResolvedValueOnce({
      game: null,
      reason: "unavailable",
    });
    setSearch("code=K7F2QD");
    await renderJoin();
    expect(screen.getByText("Не получилось проверить код. Попробуй ещё раз.")).toBeTruthy();
  });
});

describe("куда ведёт код", () => {
  it("мафийный код уводит в Мафию, даже если пришли с Алиаса", async () => {
    vi.mocked(resolveRoomGame).mockResolvedValue({ game: "mafia" });
    vi.mocked(resumeRoom).mockResolvedValueOnce({
      creds: {
        code: "K7F2QD",
        wsUrl: "ws://x",
        wsToken: "t",
        userId: "u",
        displayName: "Аня",
        game: "mafia",
      },
      gone: false,
    });
    setSearch("code=K7F2QD&from=alias");
    await renderJoin();
    expect(resumeRoom).toHaveBeenCalledWith("K7F2QD", "mafia");
    expect(routerMock.replace).toHaveBeenCalledWith("/mafia/room/K7F2QD");
  });

  it("код Алиаса уводит в Алиас, даже если пришли с Мафии", async () => {
    vi.mocked(resumeRoom).mockResolvedValueOnce({
      creds: {
        code: "K7F2QD",
        wsUrl: "ws://x",
        wsToken: "t",
        userId: "u",
        displayName: "Аня",
      },
      gone: false,
    });
    setSearch("code=K7F2QD&from=mafia");
    await renderJoin();
    expect(routerMock.replace).toHaveBeenCalledWith("/alias/room/K7F2QD");
  });

  it("акцент берётся у той игры, чей код, а не у той, откуда пришли", async () => {
    vi.mocked(resolveRoomGame).mockResolvedValue({ game: "mafia" });
    setSearch("code=K7F2QD&from=alias");
    await renderJoin();
    // resume не удался — остаёмся на форме, но она уже мафийная.
    expect(document.querySelector('.jn[data-game="mafia"]')).toBeTruthy();
    expect(screen.getByText("Это комната Мафии")).toBeTruthy();
  });

  it("без кода в адресе цвет берётся из ссылки, по которой пришли", async () => {
    setSearch("from=mafia");
    await renderJoin();
    expect(document.querySelector('.jn[data-game="mafia"]')).toBeTruthy();
    // Сервер про код не спрашивали — спрашивать нечего.
    expect(resolveRoomGame).not.toHaveBeenCalled();
  });

  it("с хаба страница нейтральная", async () => {
    await renderJoin();
    const box = document.querySelector(".jn");
    expect(box).toBeTruthy();
    expect(box?.getAttribute("data-game")).toBe(null);
  });
});
