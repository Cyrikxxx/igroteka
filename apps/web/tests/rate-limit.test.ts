// Из какого адреса считается лимит.
//
// X-Forwarded-For клиент может прислать сам, а Caddy дописывает настоящий
// адрес в конец. Пока брался первый элемент, лимит обходился одним заголовком:
// меняешь его на каждый запрос — и бакет каждый раз новый.

import { describe, it, expect } from "vitest";
import { clientKey } from "../src/lib/rate-limit";

/** NextRequest здесь не нужен — clientKey читает только заголовки. */
function request(headers: Record<string, string>) {
  return { headers: new Headers(headers) } as unknown as Parameters<typeof clientKey>[0];
}

describe("ключ для rate limit", () => {
  it("берётся последний адрес в цепочке — его дописал прокси", () => {
    expect(clientKey(request({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("подставленный клиентом адрес не побеждает настоящий", () => {
    const forged = clientKey(request({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }));
    expect(forged).toBe("203.0.113.7");
    expect(forged).not.toBe("1.2.3.4");
  });

  it("пробелы в цепочке не создают новый бакет", () => {
    expect(clientKey(request({ "x-forwarded-for": "1.2.3.4,   203.0.113.7  " }))).toBe(
      "203.0.113.7",
    );
  });

  it("без X-Forwarded-For берётся X-Real-IP", () => {
    expect(clientKey(request({ "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("совсем без заголовков — общий бакет, а не разрешение на всё", () => {
    expect(clientKey(request({}))).toBe("unknown");
  });
});
