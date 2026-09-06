// Флаг «мы в браузере» и то, ради чего он нужен: разметка сервера и первый
// рендер клиента обязаны совпадать, иначе React ругается на гидратацию.

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { act } from "@testing-library/react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { useHydrated } from "@/hooks/useHydrated";

function Screen() {
  const hydrated = useHydrated();
  // Так и выглядят настоящие экраны: пока не в браузере — заглушка, потом
  // значение из хранилища.
  const name = hydrated ? (localStorage.getItem("name") ?? "") : "";
  return <span>{name || "—"}</span>;
}

/** Ловит ругань React о расхождении разметки. */
async function hydrateAndCollect(html: string, node: React.ReactElement) {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);

  const errors: unknown[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args[0]);
  });
  await act(async () => {
    hydrateRoot(host, node);
  });
  spy.mockRestore();

  const mismatch = errors.filter((e) => /hydrat|did not match/i.test(String(e)));
  return { host, mismatch };
}

afterEach(() => {
  localStorage.clear();
});

describe("useHydrated", () => {
  it("на сервере — false, значит хранилище не читается", () => {
    localStorage.setItem("name", "Аня");
    const html = renderToString(<Screen />);
    expect(html).toContain("—");
    expect(html).not.toContain("Аня");
  });

  it("гидратация проходит без расхождения, значение появляется после", async () => {
    localStorage.setItem("name", "Аня");
    const html = renderToString(<Screen />);
    const { host, mismatch } = await hydrateAndCollect(html, <Screen />);

    expect(mismatch).toEqual([]);
    expect(host.textContent).toBe("Аня");
    document.body.removeChild(host);
  });

  it("а без флага расхождение действительно ловится", async () => {
    // Проверка самой проверки. Если читать хранилище прямо при рендере — так
    // и было сделано в лобби Мафии, — тест обязан это увидеть. Иначе
    // предыдущий тест ничего не стоит.
    function Careless() {
      const name =
        typeof window === "undefined" ? "" : (localStorage.getItem("name") ?? "");
      return <span>{name || "—"}</span>;
    }
    localStorage.setItem("name", "Вера");
    // Разметка «с сервера», где хранилища не было.
    const { host, mismatch } = await hydrateAndCollect("<span>—</span>", <Careless />);

    expect(mismatch.length).toBeGreaterThan(0);
    document.body.removeChild(host);
  });

  it("без гидратации (чистый клиент) значение видно сразу", async () => {
    localStorage.setItem("name", "Боря");
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      createRoot(host).render(<Screen />);
    });
    expect(host.textContent).toBe("Боря");
    document.body.removeChild(host);
  });
});
