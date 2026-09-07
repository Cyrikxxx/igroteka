// /api/games — ЛОКАЛЬНЫЕ игры Алиаса. Онлайн-комнаты — в /api/rooms.
// Идентификация — только cookie `aid` (см. lib/identity.ts).

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureUser, requireUserId } from "@/lib/identity";
import { visibleGamesWhere } from "@/lib/history-access";
import { loadRoomSnapshot } from "@/lib/room-snapshot";
import { closeAbandonedRoom } from "@/lib/room-cleanup";
import {
  MIN_TEAMS,
  MAX_TEAMS,
  MIN_PLAYERS_PER_TEAM,
  MAX_PLAYERS_PER_TEAM,
  TRIO_TEAMS,
  TRIO_PLAYERS_PER_TEAM,
  teamColorVar,
  ROUND_TIME_DEFAULT,
  WIN_SCORE_DEFAULT,
  PENALTY_SKIP_DEFAULT,
} from "@/constants/game";
import type { GameFormat } from "@/types";

// GET /api/games — история игр человека (по cookie aid): локальные плюс
// онлайн-партии, в которых он участвовал, — не только те, что хостил.
export async function GET() {
  try {
    const userId = await requireUserId();
    const games = await prisma.game.findMany({
      where: visibleGamesWhere(userId),
      include: {
        teams: {
          include: { players: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" },
        },
        gameCategories: { include: { category: true } },
        room: { select: { code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    // Онлайн-партия «идёт» по строке в Postgres, а на деле её живое состояние
    // могло протухнуть в Redis — тогда доигрывать нечего: там нет ни очереди
    // слов, ни чьего хода. Такие партии закрываем прямо здесь, иначе карточка
    // до скончания века зовёт «продолжить» в комнату, которой нет.
    await Promise.all(
      games.map(async (g) => {
        const code = g.room?.code;
        if (g.mode !== "ONLINE" || g.status !== "IN_PROGRESS" || !code) return;
        if (await loadRoomSnapshot(code)) return;
        await closeAbandonedRoom(code);
        g.status = "FINISHED";
        g.finishedAt = g.finishedAt ?? new Date();
      }),
    );

    // `mine` — можно ли удалять: удаление стирает партию у всех, кто в ней
    // играл, поэтому оно остаётся за владельцем. Без этой отметки клиент
    // рисовал бы корзину и гостю, а сервер отвечал бы ему 403.
    return NextResponse.json(
      games.map((g) => ({ ...g, mine: g.ownerKey === userId })),
    );
  } catch (e) {
    if ((e as Error).message === "NO_AID_COOKIE") {
      return NextResponse.json([], { status: 200 });
    }
    console.error("[GET /api/games]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/games — создать локальную игру.
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const { settings, teams, displayName } = body ?? {};
    // Втроём приходят те же три «команды» по одному человеку — меняются
    // только границы проверки состава.
    const format: GameFormat = body?.format === "TRIO" ? "TRIO" : "TEAMS";
    const trio = format === "TRIO";
    const minTeams = trio ? TRIO_TEAMS : MIN_TEAMS;
    const maxTeams = trio ? TRIO_TEAMS : MAX_TEAMS;
    const minPlayers = trio ? TRIO_PLAYERS_PER_TEAM : MIN_PLAYERS_PER_TEAM;
    const maxPlayers = trio ? TRIO_PLAYERS_PER_TEAM : MAX_PLAYERS_PER_TEAM;

    // Валидация settings
    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "settings required" }, { status: 400 });
    }
    const roundTime = Number(settings.roundTime) || ROUND_TIME_DEFAULT;
    const winScore = Number(settings.winScore) ?? WIN_SCORE_DEFAULT;
    const penaltySkip = Boolean(settings.penaltySkip ?? PENALTY_SKIP_DEFAULT);
    const categoryIds: number[] = Array.isArray(settings.categoryIds)
      ? settings.categoryIds.map((x: unknown) => Number(x)).filter(Number.isInteger)
      : [];

    // Принимаем кастомные значения тоже (не только из presets), но ограничиваем.
    if (!Number.isFinite(roundTime) || roundTime < 10 || roundTime > 300) {
      return NextResponse.json({ error: "roundTime out of range" }, { status: 400 });
    }
    if (!Number.isFinite(winScore) || winScore < 0 || winScore > 1000) {
      return NextResponse.json({ error: "winScore out of range" }, { status: 400 });
    }
    if (categoryIds.length === 0) {
      return NextResponse.json({ error: "at least 1 category required" }, { status: 400 });
    }

    // Валидация teams
    if (!Array.isArray(teams) || teams.length < minTeams || teams.length > maxTeams) {
      return NextResponse.json(
        { error: `teams: ${minTeams}..${maxTeams} required` },
        { status: 400 },
      );
    }
    for (const team of teams) {
      if (!team || typeof team.name !== "string" || team.name.trim().length === 0) {
        return NextResponse.json({ error: "team.name required" }, { status: 400 });
      }
      if (
        !Array.isArray(team.players) ||
        team.players.length < minPlayers ||
        team.players.length > maxPlayers
      ) {
        return NextResponse.json(
          { error: `players: ${minPlayers}..${maxPlayers} required per team` },
          { status: 400 },
        );
      }
      for (const p of team.players) {
        if (!p || typeof p.name !== "string" || p.name.trim().length === 0) {
          return NextResponse.json({ error: "player.name required" }, { status: 400 });
        }
      }
    }

    // Существующие категории
    const validCategories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });
    if (validCategories.length === 0) {
      return NextResponse.json({ error: "no valid categories" }, { status: 400 });
    }

    // ensureUser — чтобы FK ownerKey -> User был валидным (на случай если нужно).
    // ownerKey хранит userId как строку без FK, но всё равно создадим User для онлайн-режима в будущем.
    await ensureUser(userId, typeof displayName === "string" && displayName.trim() ? displayName.trim() : "Игрок");

    const game = await prisma.game.create({
      data: {
        mode: "LOCAL",
        format,
        ownerKey: userId,
        roundTime,
        winScore,
        penaltySkip,
        gameCategories: {
          create: validCategories.map((c) => ({ categoryId: c.id })),
        },
        teams: {
          create: teams.map((team: { name: string; players: { name: string }[] }, index: number) => ({
            name: team.name.trim().slice(0, 50),
            color: teamColorVar(index),
            order: index,
            players: {
              create: team.players.map((p, pIndex) => ({
                name: p.name.trim().slice(0, 50),
                order: pIndex,
              })),
            },
          })),
        },
      },
      include: {
        teams: {
          include: { players: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" },
        },
        gameCategories: { include: { category: true } },
      },
    });

    return NextResponse.json(game, { status: 201 });
  } catch (e) {
    if ((e as Error).message === "NO_AID_COOKIE") {
      return NextResponse.json({ error: "Identity cookie missing" }, { status: 400 });
    }
    console.error("[POST /api/games]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

