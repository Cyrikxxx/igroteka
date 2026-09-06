// Заглушка next/navigation. Страницы читают код комнаты из адреса и уводят
// человека роутером; поднимать ради этого настоящий роутер Next не нужно, а
// переходы как раз и хочется проверять — поэтому они шпионы.
//
// Подменяется через resolve.alias в vitest.config.ts.

import { vi } from "vitest";

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

let params: Record<string, string> = {};
let search = new URLSearchParams();
let pathname = "/";

/** Что вернёт useParams — например { code: "ABCDEF" }. */
export function setRouteParams(next: Record<string, string>): void {
  params = next;
}

/** Строка запроса, например "code=ABCDEF". */
export function setSearch(qs: string): void {
  search = new URLSearchParams(qs);
}

export function setPathname(next: string): void {
  pathname = next;
}

/** Вызывать в beforeEach: адрес и счётчики переходов начинаются с чистого. */
export function resetNavigation(): void {
  for (const fn of Object.values(routerMock)) fn.mockReset();
  params = {};
  search = new URLSearchParams();
  pathname = "/";
}

export function useRouter() {
  return routerMock;
}

export function useParams() {
  return params;
}

export function useSearchParams() {
  return search;
}

export function usePathname() {
  return pathname;
}
