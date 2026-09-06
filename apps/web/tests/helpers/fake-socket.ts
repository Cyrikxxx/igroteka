// Поддельный сокет для тестов хуков и экранов.
//
// Весь клиент ходит в сеть через единственный модуль lib/socket-client, и это
// удобный шов: подменив его, можно проиграть любой сценарий — «пришёл снапшот
// с паузой», «пришёл тик», «сервер отключил» — не поднимая ни ws, ни сети.

import { vi } from "vitest";

type Handler = (...args: unknown[]) => void;

export interface SentMessage {
  event: string;
  payload: unknown;
  /** Ответ сервера, если тест его подставит. */
  ack?: (resp: unknown) => void;
}

export class FakeSocket {
  connected = true;
  readonly sent: SentMessage[] = [];
  private readonly handlers = new Map<string, Set<Handler>>();

  /** У настоящего сокета менеджер отдельно — хуки слушают на нём реконнекты. */
  readonly io = {
    on: vi.fn(),
    off: vi.fn(),
  };

  on(event: string, handler: Handler): this {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return this;
  }

  once(event: string, handler: Handler): this {
    const wrapped: Handler = (...args) => {
      this.off(event, wrapped);
      handler(...args);
    };
    return this.on(event, wrapped);
  }

  off(event: string, handler?: Handler): this {
    if (!handler) this.handlers.delete(event);
    else this.handlers.get(event)?.delete(handler);
    return this;
  }

  emit(event: string, payload?: unknown, ack?: (resp: unknown) => void): this {
    this.sent.push({ event, payload, ack });
    return this;
  }

  disconnect(): this {
    this.connected = false;
    this.server("disconnect", "io client disconnect");
    return this;
  }

  // ─── управление из теста ───

  /** Сервер прислал событие. */
  server(event: string, payload?: unknown): void {
    for (const h of [...(this.handlers.get(event) ?? [])]) h(payload);
  }

  /** Есть ли подписчик на событие — проверка, что хук вообще слушает. */
  listens(event: string): boolean {
    return (this.handlers.get(event)?.size ?? 0) > 0;
  }

  /** Последнее отправленное сообщение этого типа. */
  lastSent(event: string): SentMessage | undefined {
    return [...this.sent].reverse().find((m) => m.event === event);
  }

  /** Ответить на последний такой запрос — как это делает сервер через ack. */
  reply(event: string, resp: unknown): void {
    this.lastSent(event)?.ack?.(resp);
  }

  /** Все события этого типа, по порядку. */
  sentAll(event: string): SentMessage[] {
    return this.sent.filter((m) => m.event === event);
  }
}
