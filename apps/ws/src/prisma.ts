// Реэкспорт общего клиента (packages/shared/src/server/prisma.ts),
// чтобы web и ws работали с одними настройками Prisma.

export { prisma, default } from "@alias/shared/server/prisma";
