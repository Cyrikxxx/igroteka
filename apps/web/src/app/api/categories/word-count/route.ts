// GET /api/categories/word-count?ids=1,2,3 — сколько РАЗНЫХ слов даёт набор.
//
// Сложить _count выбранных категорий нельзя: уровни сложности намеренно
// пересекаются с темами, и сумма завышает итог на сотни слов. Проверено на
// живых данных — «Животные» + «Лёгкий уровень» это 1605 при сложении и 1442
// на самом деле.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get("ids") ?? "";
    const ids = [
      ...new Set(
        raw
          .split(",")
          .map((x) => Number(x.trim()))
          .filter(Number.isInteger),
      ),
    ];
    if (ids.length === 0) return NextResponse.json({ count: 0 });

    const count = await prisma.word.count({
      where: { categories: { some: { categoryId: { in: ids } } } },
    });
    return NextResponse.json({ count });
  } catch (error) {
    console.error("[GET /api/categories/word-count]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
