// GET /api/categories — список публичных категорий с количеством слов.
// См. PROMPT.md §2.3.1.

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { isPublic: true },
      include: { _count: { select: { words: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("[GET /api/categories]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
