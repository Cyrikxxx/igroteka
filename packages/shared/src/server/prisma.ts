// Singleton Prisma client — общий для web и ws. Оба приложения работают с
// одной схемой (корневой prisma/schema.prisma), поэтому и настройки клиента
// должны быть в одном месте.
//
// ВНИМАНИЕ: серверный модуль. Импортировать только из серверного кода —
// в index.ts пакета он намеренно НЕ реэкспортируется, чтобы Prisma
// никогда не попала в клиентский бандл.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// В dev держим клиент в globalThis, чтобы hot reload не открывал новый пул
// соединений на каждую перезагрузку модуля.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
