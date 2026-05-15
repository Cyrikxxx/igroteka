# CURRENT_CODE — снимок ключевых файлов старого проекта

> Это **существующий** проект `alias-game/` (рабочая локальная версия).
> Все файлы взяты as-is. Используй как референс при реализации v2 — что
> переиспользовать, а что переписать (см. PROMPT.md §2.1.2).
>
> В корне старого проекта реальные файлы лежат по другим путям, чем
> писалось в исходном промпте:
> - `types/game.ts` → реально `src/types/index.ts`
> - `components/GameBoard.tsx` → реально нет; есть набор
>   `src/components/game/{WordCard,RoundSummary,TeamForm,SettingsForm,WinnerBanner,GameHistory}.tsx`
> - `app/api/games/route.ts` → `src/app/api/games/route.ts`
> - `app/api/games/[id]/rounds/route.ts` → `src/app/api/games/[id]/rounds/route.ts`

---

## 1. `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Category {
  id             Int            @id @default(autoincrement())
  name           String         @unique
  slug           String         @unique
  createdAt      DateTime       @default(now())
  gameCategories GameCategory[]
  words          WordCategory[]

  @@index([name])
  @@index([slug])
}

model Word {
  id         Int            @id @default(autoincrement())
  text       String         @unique
  createdAt  DateTime       @default(now())
  roundWords RoundWord[]
  categories WordCategory[]

  @@index([text])
}

model WordCategory {
  wordId     Int
  categoryId Int
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  word       Word     @relation(fields: [wordId], references: [id], onDelete: Cascade)

  @@id([wordId, categoryId])
  @@index([categoryId])
}

model Game {
  id                 String         @id @default(cuid())
  sessionId          String
  status             GameStatus     @default(IN_PROGRESS)
  roundTime          Int            @default(60)
  winScore           Int            @default(50)
  penaltySkip        Boolean        @default(false)
  currentTeamIndex   Int            @default(0)
  currentRoundNumber Int            @default(1)
  usedWordIds        Int[]          @default([])
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt
  gameCategories     GameCategory[]
  rounds             Round[]
  teams              Team[]

  @@index([sessionId])
}

model GameCategory {
  gameId     String
  categoryId Int
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  game       Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)

  @@id([gameId, categoryId])
  @@index([gameId])
}

model Team {
  id                 Int      @id @default(autoincrement())
  name               String
  score              Int      @default(0)
  order              Int
  currentPlayerIndex Int      @default(0)
  gameId             String
  players            Player[]
  rounds             Round[]
  game               Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)

  @@index([gameId])
}

model Player {
  id     Int    @id @default(autoincrement())
  name   String
  order  Int
  teamId Int
  team   Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@index([teamId])
}

model Round {
  id          Int         @id @default(autoincrement())
  roundNumber Int
  teamId      Int
  gameId      String
  playerName  String
  scoreEarned Int         @default(0)
  createdAt   DateTime    @default(now())
  game        Game        @relation(fields: [gameId], references: [id], onDelete: Cascade)
  team        Team        @relation(fields: [teamId], references: [id], onDelete: Cascade)
  words       RoundWord[]

  @@index([gameId])
  @@index([teamId])
}

model RoundWord {
  id      Int     @id @default(autoincrement())
  guessed Boolean
  roundId Int
  wordId  Int
  round   Round   @relation(fields: [roundId], references: [id], onDelete: Cascade)
  word    Word    @relation(fields: [wordId], references: [id], onDelete: Cascade)

  @@index([roundId])
  @@index([wordId])
}

enum GameStatus {
  IN_PROGRESS
  FINISHED
}
```

---

## 2. `src/types/index.ts` (вместо упомянутого `types/game.ts`)

```ts
// Здесь описываем ФОРМУ наших данных
// interface — это как чертёж: говорит какие поля есть у объекта

// Команда при создании (ещё не сохранена в БД)
export interface TeamSetup {
	name: string // Название команды
	players: { name: string }[] // Массив игроков (у каждого есть имя)
}

// Настройки игры
export interface GameSettings {
	roundTime: number // Время раунда в секундах
	winScore: number // Очки для победы (0 = бесконечно)
	penaltySkip: boolean // Штраф за пропуск?
	categoryIds: number[] // ID выбранных категорий
}

// Слово в текущем раунде (на клиенте)
export interface WordInRound {
	wordId: number
	text: string
	guessed: boolean | null // true=угадано, false=пропущено, null=ещё не показано
}

// ==========================================
// Ниже — типы данных, которые приходят с сервера (из API)
// "FromAPI" в названии означает — так выглядят данные в JSON-ответе
// ==========================================

export interface GameFromAPI {
	id: string
	sessionId: string
	status: 'IN_PROGRESS' | 'FINISHED'
	roundTime: number
	winScore: number
	penaltySkip: boolean
	currentTeamIndex: number
	currentRoundNumber: number
	usedWordIds: number[]
	createdAt: string
	updatedAt: string
	teams: TeamFromAPI[]
	rounds: RoundFromAPI[]
	gameCategories: { categoryId: number; category?: { name: string } }[]
}

export interface TeamFromAPI {
	id: number
	name: string
	score: number
	order: number
	currentPlayerIndex: number
	gameId: string
	players: PlayerFromAPI[]
}

export interface PlayerFromAPI {
	id: number
	name: string
	order: number
	teamId: number
}

export interface RoundFromAPI {
	id: number
	roundNumber: number
	teamId: number
	gameId: string
	playerName: string
	scoreEarned: number
	createdAt: string
	words: RoundWordFromAPI[]
}

export interface RoundWordFromAPI {
	id: number
	guessed: boolean
	wordId: number
	word?: { text: string }
}

export interface CategoryFromAPI {
	id: number
	name: string
	slug: string
	_count?: { words: number } // Количество слов в категории
}

// Результат сохранения раунда
export interface RoundResult {
	round: RoundFromAPI
	teamScore: number // Обновлённый счёт команды
	gameFinished: boolean // Закончилась ли игра?
	winnerId?: number // ID команды-победителя (если есть)
	nextTeamIndex: number
	nextRoundNumber: number
}
```

---

## 3. Существующие игровые компоненты (вместо упомянутого `GameBoard.tsx`)

В старом проекте нет одного `GameBoard.tsx` — вместо него игровая
страница `src/app/game/[id]/round/page.tsx` собирается из нескольких
компонентов. Привожу их по очереди.

### 3.1. `src/app/game/[id]/round/page.tsx` (главный «игровой» экран)

```tsx
'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { GameFromAPI, WordInRound } from '@/types'
import { getSessionId } from '@/lib/session'
import { useTimer } from '@/hooks/useTimer'
import Timer from '@/components/ui/Timer'
import WordCard from '@/components/game/WordCard'
import RoundSummary from '@/components/game/RoundSummary'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Check, X, Pause, Play, Square, Loader2 } from 'lucide-react'

export default function RoundPage() {
	const router = useRouter()
	const params = useParams()
	const gameId = params.id as string

	const [game, setGame] = useState<GameFromAPI | null>(null)
	const [words, setWords] = useState<WordInRound[]>([])
	const [currentIndex, setCurrentIndex] = useState(0)
	const [showSummary, setShowSummary] = useState(false)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [isPaused, setIsPaused] = useState(false)
	const audioRef = useRef<HTMLAudioElement | null>(null)

	const wordsRef = useRef(words)
	wordsRef.current = words
	const currentIndexRef = useRef(currentIndex)
	currentIndexRef.current = currentIndex
	const hasFetchedRef = useRef(false)

	useEffect(() => {
		audioRef.current = new Audio('/sounds/timer-end.mp3')
		audioRef.current.preload = 'auto'

		return () => {
			if (audioRef.current) {
				audioRef.current.pause()
				audioRef.current = null
			}
		}
	}, [])

	const handleTimeUp = useCallback(() => {
		const updatedWords = [...wordsRef.current]
		if (currentIndexRef.current < updatedWords.length && updatedWords[currentIndexRef.current].guessed === null) {
			updatedWords[currentIndexRef.current] = {
				...updatedWords[currentIndexRef.current],
				guessed: false,
			}
		}
		setWords(updatedWords)
		setShowSummary(true)

		if (audioRef.current) {
			audioRef.current.play().catch(err => {
				console.error('Failed to play sound:', err)
			})
		}
	}, [])

	const { timeLeft, start, pause } = useTimer({
		initialTime: game?.roundTime ?? 60,
		onTimeUp: handleTimeUp,
	})

	useEffect(() => {
		if (hasFetchedRef.current) return
		hasFetchedRef.current = true

		const fetchData = async () => {
			try {
				const [gameRes, wordsRes] = await Promise.all([
					fetch(`/api/games/${gameId}`),
					fetch(`/api/games/${gameId}/words`),
				])

				if (gameRes.ok && wordsRes.ok) {
					const gameData = await gameRes.json()
					const wordsData = await wordsRes.json()

					setGame(gameData)
					setWords(
						wordsData.map((w: { id: number; text: string }) => ({
							wordId: w.id,
							text: w.text,
							guessed: null,
						}))
					)
				}
			} catch (error) {
				console.error('Failed to fetch data:', error)
			} finally {
				setLoading(false)
			}
		}
		fetchData()
	}, [gameId])

	useEffect(() => {
		if (!loading && game) {
			start()
		}
	}, [loading, game, start])

	const handleGuess = (guessed: boolean) => {
		const updated = [...words]
		updated[currentIndex] = { ...updated[currentIndex], guessed }
		setWords(updated)
		setCurrentIndex(prev => prev + 1)
	}

	const handleToggleWord = (displayIndex: number) => {
		const answeredWords = words.filter(w => w.guessed !== null)
		const actualIndex = words.findIndex(w => w.wordId === answeredWords[displayIndex].wordId)
		if (actualIndex === -1) return

		const updated = [...words]
		updated[actualIndex] = {
			...updated[actualIndex],
			guessed: !updated[actualIndex].guessed,
		}
		setWords(updated)
	}

	const handleConfirm = async () => {
		if (!game || saving) return
		const currentTeam = game.teams.find(t => t.order === game.currentTeamIndex)
		if (!currentTeam) return
		const currentPlayer = currentTeam.players[currentTeam.currentPlayerIndex]
		const answeredWords = words.filter(w => w.guessed !== null)

		setSaving(true)
		try {
			const sessionId = getSessionId()
			const res = await fetch(`/api/games/${gameId}/rounds`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					teamId: currentTeam.id,
					playerName: currentPlayer.name,
					sessionId,
					words: answeredWords.map(w => ({ wordId: w.wordId, guessed: w.guessed })),
				}),
			})
			if (res.ok) {
				const result = await res.json()
				if (result.gameFinished) router.replace(`/game/${gameId}/results`)
				else router.replace(`/game/${gameId}/turn`)
			}
		} catch (error) {
			console.error('Failed to save round:', error)
		} finally {
			setSaving(false)
		}
	}

	// ... handlePause/handleResume/handleEndRound и JSX (Timer, WordCard, ActionBar, RoundSummary, Pause modal)
	// (полностью идентично оригиналу — см. реальный файл)
}
```

(Полный исходник — около 300 строк, паттерн без сюрпризов: `useTimer` →
`WordCard` → `ActionBar` → `RoundSummary`-модалка → POST.)

### 3.2. `src/components/game/WordCard.tsx`

```tsx
'use client'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { memo } from 'react'

interface WordCardProps {
	word: string
}

function WordCard({ word }: WordCardProps) {
	return (
		<div className='flex items-center justify-center flex-1 px-4'>
			<Card className='w-full max-w-2xl min-h-[200px] flex items-center justify-center border-2 border-primary p-8'>
				<h1
					className={cn(
						'text-4xl md:text-5xl font-bold text-foreground text-center',
						'animate-bounce-in select-none'
					)}
					key={word}
				>
					{word}
				</h1>
			</Card>
		</div>
	)
}

export default memo(WordCard)
```

### 3.3. `src/components/game/RoundSummary.tsx`

```tsx
'use client'
import { WordInRound } from '@/types'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'

interface RoundSummaryProps {
	isOpen: boolean
	words: WordInRound[]
	onToggleWord: (index: number) => void
	onConfirm: () => void
	penaltySkip: boolean
	teamName: string
}

export default function RoundSummary({
	isOpen, words, onToggleWord, onConfirm, penaltySkip, teamName,
}: RoundSummaryProps) {
	const answered = words.filter(w => w.guessed !== null)
	const guessedCount = answered.filter(w => w.guessed === true).length
	const skippedCount = answered.filter(w => w.guessed === false).length
	const score = guessedCount - (penaltySkip ? skippedCount : 0)

	return (
		<Modal isOpen={isOpen} title={`Итоги раунда — ${teamName}`}>
			<div className='space-y-2 max-h-[50vh] overflow-y-auto mb-4'>
				{answered.map((word, i) => (
					<button
						key={word.wordId}
						onClick={() => onToggleWord(i)}
						className={cn(
							'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all border-2',
							word.guessed
								? 'bg-primary/10 border-primary/50 hover:bg-primary/20'
								: 'bg-destructive/10 border-destructive/50 hover:bg-destructive/20'
						)}
					>
						{word.guessed ? <Check className='w-5 h-5 text-primary' /> : <X className='w-5 h-5 text-destructive' />}
						<span className='text-foreground font-medium flex-1 text-left'>{word.text}</span>
					</button>
				))}
			</div>
			<div className='bg-secondary rounded-lg p-4 mb-4'>
				<div className='flex justify-between text-sm text-muted-foreground'>
					<span>Угадано:</span><span className='text-primary font-bold'>+{guessedCount}</span>
				</div>
				{skippedCount > 0 && (
					<div className='flex justify-between text-sm text-muted-foreground'>
						<span>Пропущено:</span>
						<span className={penaltySkip ? 'text-destructive font-bold' : 'text-muted-foreground'}>
							{penaltySkip ? `−${skippedCount}` : `${skippedCount} (без штрафа)`}
						</span>
					</div>
				)}
				<div className='flex justify-between text-lg font-bold text-foreground mt-2 pt-2 border-t border-border'>
					<span>Итого:</span>
					<span className={score >= 0 ? 'text-primary' : 'text-destructive'}>
						{score > 0 ? '+' : ''}{score}
					</span>
				</div>
			</div>
			<Button fullWidth size='xl' onClick={onConfirm}>Подтвердить</Button>
		</Modal>
	)
}
```

### 3.4. `src/components/game/TeamForm.tsx` — (укорочено, см. реальный файл)

Форма редактирования команд (2..4 команды, 2..6 игроков в каждой). Каждая
команда красится через `TEAM_COLORS[index].cssVar`. Кнопки `+ Добавить
игрока`, `+ Добавить команду`. Используется на `/game/new`.

### 3.5. `src/components/game/SettingsForm.tsx` — (укорочено)

Чипсы выбора `roundTime` (30/45/60/90/120 + Своё), `winScore`
(25/50/75/100 + Своё), toggle `penaltySkip`, grid категорий (с
`_count.words`), модалки кастомных значений.

### 3.6. `src/components/game/GameHistory.tsx` — (укорочено)

Список карточек прошедших/текущих игр со счётом, бейджем статуса, датой,
кнопками `Продолжить` (для IN_PROGRESS) и `Удалить`.

### 3.7. `src/components/game/WinnerBanner.tsx` — (укорочено)

Баннер на странице результатов: трофей + название команды-победителя +
конфетти.

---

## 4. `src/app/api/games/route.ts`

```ts
// Обрабатывает запросы к /api/games
// GET — получить все игры пользователя
// POST — создать новую игру

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/games?sessionId=xxx — все игры текущей сессии
export async function GET(request: NextRequest) {
	try {
		const sessionId = request.nextUrl.searchParams.get('sessionId')
		if (!sessionId) {
			return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
		}

		const games = await prisma.game.findMany({
			where: { sessionId },
			include: {
				teams: {
					include: { players: { orderBy: { order: 'asc' } } },
					orderBy: { order: 'asc' },
				},
				gameCategories: { include: { category: true } },
			},
			orderBy: { createdAt: 'desc' },
		})

		return NextResponse.json(games)
	} catch (error) {
		console.error('GET /api/games error:', error)
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}

// POST /api/games — создать новую игру
export async function POST(request: NextRequest) {
	try {
		const body = await request.json()
		const { sessionId, settings, teams } = body

		if (!sessionId || !settings || !teams || teams.length < 2) {
			return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
		}
		// ...валидация settings.roundTime (10..300), winScore (0..1000),
		// penaltySkip:boolean, categoryIds (≥1), teams (≤4),
		// каждой команде имя (≤50 символов), 2..6 игроков, имя игрока (≤50 символов).

		const game = await prisma.game.create({
			data: {
				sessionId,
				roundTime: settings.roundTime,
				winScore: settings.winScore,
				penaltySkip: settings.penaltySkip,
				gameCategories: {
					create: settings.categoryIds.map((categoryId: number) => ({ categoryId })),
				},
				teams: {
					create: teams.map((team: { name: string; players: { name: string }[] }, index: number) => ({
						name: team.name,
						order: index,
						players: {
							create: team.players.map((player: { name: string }, pIndex: number) => ({
								name: player.name, order: pIndex,
							})),
						},
					})),
				},
			},
			include: {
				teams: {
					include: { players: { orderBy: { order: 'asc' } } },
					orderBy: { order: 'asc' },
				},
				gameCategories: { include: { category: true } },
			},
		})

		return NextResponse.json(game, { status: 201 })
	} catch (error) {
		console.error('POST /api/games error:', error)
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}
```

---

## 5. `src/app/api/games/[id]/rounds/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const startTime = Date.now()
	let id: string = ''
	try {
		id = (await params).id

		const body = await request.json()
		const { teamId, playerName, words, sessionId } = body

		if (!teamId || !playerName || !words || !sessionId) {
			return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
		}
		// ...валидация типов teamId/playerName/words

		const game = await prisma.game.findUnique({
			where: { id },
			include: {
				teams: {
					include: { players: { orderBy: { order: 'asc' } } },
					orderBy: { order: 'asc' },
				},
			},
		})

		if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
		if (game.sessionId !== sessionId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

		const guessedCount = words.filter((w: { guessed: boolean }) => w.guessed).length
		const skippedCount = words.filter((w: { guessed: boolean }) => !w.guessed).length
		const scoreEarned = guessedCount - (game.penaltySkip ? skippedCount : 0)

		const team = game.teams.find(t => t.id === teamId)
		if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

		const newTeamScore = Math.max(0, team.score + scoreEarned)

		const numTeams = game.teams.length
		const nextTeamIndex = (game.currentTeamIndex + 1) % numTeams
		const nextRoundNumber = nextTeamIndex === 0 ? game.currentRoundNumber + 1 : game.currentRoundNumber

		const newUsedWordIds = words.map((w: { wordId: number }) => w.wordId)

		let gameFinished = false
		let winnerId: number | undefined

		if (game.winScore > 0) {
			const updatedTeams = game.teams.map(t => (t.id === teamId ? { ...t, score: newTeamScore } : t))
			const isEndOfCycle = nextTeamIndex === 0
			if (isEndOfCycle) {
				const qualifiedTeams = updatedTeams.filter(t => t.score >= game.winScore)
				if (qualifiedTeams.length > 0) {
					const winner = qualifiedTeams.reduce((best, t) => (t.score > best.score ? t : best))
					gameFinished = true
					winnerId = winner.id
				}
			}
		}

		const result = await prisma.$transaction(async tx => {
			const round = await tx.round.create({
				data: {
					roundNumber: game.currentRoundNumber,
					teamId, gameId: id, playerName, scoreEarned,
					words: {
						create: words.map((w: { wordId: number; guessed: boolean }) => ({
							wordId: w.wordId, guessed: w.guessed,
						})),
					},
				},
				select: { id: true, roundNumber: true, scoreEarned: true },
			})

			await tx.team.update({
				where: { id: teamId },
				data: {
					score: newTeamScore,
					currentPlayerIndex: (team.currentPlayerIndex + 1) % team.players.length,
				},
			})

			await tx.game.update({
				where: { id },
				data: {
					currentTeamIndex: gameFinished ? game.currentTeamIndex : nextTeamIndex,
					currentRoundNumber: gameFinished ? game.currentRoundNumber : nextRoundNumber,
					status: gameFinished ? 'FINISHED' : 'IN_PROGRESS',
					usedWordIds: { push: newUsedWordIds },
				},
			})

			return { round, teamScore: newTeamScore, gameFinished, winnerId, nextTeamIndex, nextRoundNumber }
		})

		return NextResponse.json(result)
	} catch (error) {
		console.error(`[POST /api/games/${id || 'unknown'}/rounds] error:`, error)
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}
```

---

## 6. Дополнительно — `src/app/api/games/[id]/words/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { shuffleArray } from '@/lib/utils'
import { WORDS_BATCH_SIZE } from '@/constants'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	let id: string = ''
	try {
		id = (await params).id
		const game = await prisma.game.findUnique({
			where: { id },
			select: { gameCategories: { select: { categoryId: true } } },
		})
		if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })

		const categoryIds = game.gameCategories.map(gc => gc.categoryId)

		// NOT EXISTS быстрее чем notIn
		const words = await prisma.word.findMany({
			where: {
				categories: { some: { categoryId: { in: categoryIds } } },
				NOT: {
					roundWords: { some: { round: { gameId: id } } },
				},
			},
			select: { id: true, text: true },
		})
		const shuffled = shuffleArray(words).slice(0, WORDS_BATCH_SIZE)
		return NextResponse.json(shuffled)
	} catch (error) {
		console.error(`[GET /api/games/${id || 'unknown'}/words] error:`, error)
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}
```

---

## 7. Хелперы / hooks / константы

### `src/lib/utils.ts`

```ts
export function cn(...classes: (string | boolean | undefined | null)[]): string {
	return classes.filter(Boolean).join(' ')
}

export function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array]
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
	}
	return shuffled
}

export function formatDate(date: string | Date): string {
	return new Date(date).toLocaleDateString('ru-RU', {
		day: 'numeric', month: 'short', year: 'numeric',
		hour: '2-digit', minute: '2-digit',
	})
}
```

### `src/lib/prisma.ts`

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
export default prisma
```

### `src/lib/session.ts`

```ts
export function getSessionId(): string {
	if (typeof window === 'undefined') return ''
	let sessionId = localStorage.getItem('alias_session_id')
	if (!sessionId) {
		sessionId = 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
		localStorage.setItem('alias_session_id', sessionId)
	}
	return sessionId
}
```

### `src/hooks/useTimer.ts`

```ts
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

interface UseTimerOptions {
	initialTime: number
	onTimeUp?: () => void
	autoStart?: boolean
}

export function useTimer({ initialTime, onTimeUp, autoStart = false }: UseTimerOptions) {
	const [timeLeft, setTimeLeft] = useState(initialTime)
	const [isRunning, setIsRunning] = useState(autoStart)

	const onTimeUpRef = useRef(onTimeUp)
	onTimeUpRef.current = onTimeUp

	useEffect(() => { setTimeLeft(initialTime) }, [initialTime])

	useEffect(() => {
		if (!isRunning || timeLeft <= 0) return
		const interval = setInterval(() => {
			setTimeLeft(prev => {
				if (prev <= 1) {
					setIsRunning(false)
					setTimeout(() => onTimeUpRef.current?.(), 0)
					return 0
				}
				return prev - 1
			})
		}, 1000)
		return () => clearInterval(interval)
	}, [isRunning, timeLeft])

	const start = useCallback(() => setIsRunning(true), [])
	const pause = useCallback(() => setIsRunning(false), [])
	const reset = useCallback(() => { setTimeLeft(initialTime); setIsRunning(false) }, [initialTime])

	return { timeLeft, isRunning, start, pause, reset }
}
```

### `src/constants/index.ts`

```ts
export const MIN_TEAMS = 2
export const MAX_TEAMS = 4
export const MIN_PLAYERS_PER_TEAM = 2
export const MAX_PLAYERS_PER_TEAM = 6

export const ROUND_TIME_OPTIONS = [30, 45, 60, 90, 120]
export const WIN_SCORE_OPTIONS = [25, 50, 75, 100]

export const WORDS_BATCH_SIZE = 50
export const TIMER_WARNING_SECONDS = 5

export const TEAM_COLORS = [
	{ bg: 'bg-primary/10', border: 'border-primary', text: 'text-primary', avatar: 'bg-primary/20', cssVar: 'var(--color-primary)' },
	{ bg: 'bg-accent/10',  border: 'border-accent',  text: 'text-accent',  avatar: 'bg-accent/20',  cssVar: 'var(--color-accent)'  },
	{ bg: '', border: '', text: '', avatar: '', cssVar: 'var(--color-blue)'  },
	{ bg: '', border: '', text: '', avatar: '', cssVar: 'var(--color-purple)'},
]
```

---

## 8. Что важно унаследовать в v2

1. **Схема подсчёта очков и переключения хода** (см. `rounds/route.ts`).
   В v2 такой же алгоритм должен лежать в `scoreService` / `turnService`
   и применяться одинаково в локальной (REST) и онлайн (WS) ветках.
2. **Запрос неиспользованных слов** через `NOT EXISTS roundWords`. Это
   единственное место, где старый код уже оптимизировался; повторить.
3. **Транзакция**: создание `Round + RoundWord[]`, обновление `Team`
   (score, currentPlayerIndex), обновление `Game` (currentTeamIndex,
   currentRoundNumber, status, usedWordIds) — всё в одной транзакции.
   В v2 — то же самое, через тот же `prisma.$transaction`.
4. **shuffleArray** + 50-словный батч.
5. **Идентификация устройства через localStorage**. В v2 заменяется на
   cookie `aid`, но семантика «один человек = одно устройство, без
   логина» — остаётся.
6. **Структура валидации входных данных** в API-роутах — переиспользовать
   стиль (ясные сообщения об ошибках, `400/403/404`).
