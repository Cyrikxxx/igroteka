// Singleton Prisma client. Используем сгенерированный клиент из shared-пакета
// (`packages/shared/src/generated/prisma/`), чтобы и Next.js, и WS-сервер
// импортировали одну и ту же модель. НЕ импортировать из `@prisma/client`.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
