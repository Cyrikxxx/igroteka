// GET /api/categories — весь каталог одним ответом: уровни сложности
// отдельно, темы внутри своих подборок. Экранов выбора три (локальная игра,
// создание комнаты, настройки лобби), и каждому нужно одно и то же.

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { CatalogFromAPI, CategoryFromAPI } from "@/types";

const CATEGORY_FIELDS = {
  id: true,
  name: true,
  slug: true,
  emoji: true,
  isPublic: true,
  kind: true,
  season: true,
  isPopular: true,
  _count: { select: { words: true } },
} as const;

export async function GET() {
  try {
    const [levels, collections] = await Promise.all([
      prisma.category.findMany({
        where: { isPublic: true, kind: "LEVEL" },
        select: CATEGORY_FIELDS,
        orderBy: { order: "asc" },
      }),
      prisma.collection.findMany({
        orderBy: { order: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          emoji: true,
          description: true,
          categories: {
            where: { isPublic: true },
            select: CATEGORY_FIELDS,
            orderBy: { order: "asc" },
          },
        },
      }),
    ]);

    const catalog: CatalogFromAPI = {
      levels: levels as CategoryFromAPI[],
      collections: collections.map((c) => ({
        ...c,
        categories: c.categories as CategoryFromAPI[],
      })),
    };
    return NextResponse.json(catalog);
  } catch (error) {
    console.error("[GET /api/categories]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
