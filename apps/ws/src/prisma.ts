// Singleton Prisma client для WS-сервера. Использует тот же сгенерированный
// клиент, что и apps/web (`packages/shared/src/generated/prisma/`).

import { PrismaClient } from "@alias/shared/generated/prisma";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
