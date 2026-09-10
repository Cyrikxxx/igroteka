"use client";

// Общий вход по коду — один на обе игры.
//
// Раньше входов было два, у каждой игры свой, и дверь решала, куда ты
// попадёшь. Решала неправильно: игра — это свойство кода комнаты, а не того,
// откуда человек пришёл. Мафийный код, набранный в форме Алиаса, доходил до
// серверного входа Алиаса, который не находил там своего снимка, считал
// комнату брошенной и закрывал её — живую партию выкидывало разом у всех.
//
// Здесь код сначала спрашивают у сервера (`/api/rooms/resolve`), и только
// потом стучатся во вход нужной игры. Откуда человек пришёл, влияет ровно на
// одно — на цвет акцента: с хаба нейтральный, с лендинга Мафии красный, с
// лендинга Алиаса зелёный. Как только игра известна, акцент подстраивается
// под неё, чтобы переход в комнату не менял цвет рывком.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import MafiaShell from "@/components/mafia/MafiaShell";
import MafiaAvatar from "@/components/mafia/MafiaAvatar";
import { saveRoomCreds, saveDisplayName, loadDisplayName } from "@/lib/room-session";
import { useHydrated } from "@/hooks/useHydrated";
import { resumeRoom } from "@/lib/room-resume";
import {
  resolveRoomGame,
  resolveErrorText,
  NOT_FOUND_TEXT,
  type RoomGame,
} from "@/lib/room-platform";
import {
  ROOM_CODE_LENGTH,
  WRONG_LAYOUT_HINT,
  pasteCode,
  typeCode,
} from "@/lib/room-code-input";

/** Ответ входа — у обеих игр одинаковой формы. */
interface JoinResponse {
  room: { code: string };
  user: { id: string; displayName: string };
  wsUrl: string;
  wsToken: string;
}

const roomPath = (game: RoomGame, code: string) =>
  game === "mafia" ? `/mafia/room/${code}` : `/alias/room/${code}`;

const joinApi = (game: RoomGame, code: string) =>
  game === "mafia" ? `/api/mafia/rooms/${code}/join` : `/api/rooms/${code}/join`;

/** Откуда пришли — только для цвета. Куда попадём, решает код. */
function originFrom(raw: string | null): RoomGame | null {
  return raw === "mafia" || raw === "alias" ? raw : null;
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <MafiaShell>
          <div />
        </MafiaShell>
      }
    >
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Имя и код выводятся при рендере, а не подставляются эффектом. Хранилище
  // читаем только после гидратации: на сервере его нет.
  const hydrated = useHydrated();
  const [typedCode, setTypedCode] = useState<string | null>(null);
  const [typedName, setTypedName] = useState<string | null>(null);

  const codeFromUrl = useMemo(() => {
    const raw = searchParams.get("code");
    return raw ? pasteCode(raw.trim()) : "";
  }, [searchParams]);
  const origin = originFrom(searchParams.get("from"));

  const code = typedCode ?? codeFromUrl;
  const name = typedName ?? (hydrated ? loadDisplayName() : "");
  const setCode = setTypedCode;
  const setName = setTypedName;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wrongLayout, setWrongLayout] = useState(false);
  const [resumeFailed, setResumeFailed] = useState(false);
  /** Что ответил сервер про этот код. Пока не спрашивали — красимся по origin. */
  const [detected, setDetected] = useState<RoomGame | null>(null);
  const accent = detected ?? origin;

  const resuming = codeFromUrl.length === ROOM_CODE_LENGTH && !resumeFailed;

  // Пришли по ссылке-приглашению: сначала узнаём игру, потом пробуем вернуться
  // в комнату молча — тому, кто в ней уже сидит, имя вводить незачем.
  useEffect(() => {
    if (codeFromUrl.length !== ROOM_CODE_LENGTH) return;
    let alive = true;
    (async () => {
      const outcome = await resolveRoomGame(codeFromUrl);
      if (!alive) return;
      if (!outcome.game) {
        setError(resolveErrorText(outcome.reason));
        setResumeFailed(true);
        return;
      }
      setDetected(outcome.game);
      const resumed = await resumeRoom(codeFromUrl, outcome.game);
      if (!alive) return;
      if (resumed.creds) {
        router.replace(roomPath(outcome.game, resumed.creds.code));
        return;
      }
      // Комнаты нет или вход закрыт — говорим об этом сразу, а не после того,
      // как человек введёт имя и получит отказ.
      if (resumed.gone && resumed.notice) setError(resumed.notice);
      setResumeFailed(true);
    })();
    return () => {
      alive = false;
    };
  }, [codeFromUrl, router]);

  const full = code.length === ROOM_CODE_LENGTH && name.trim().length > 0;

  const submit = async () => {
    if (!full) {
      setError(code.length !== ROOM_CODE_LENGTH ? "Код из 6 символов" : "Введите имя");
      return;
    }
    setSubmitting(true);
    setError(null);

    const outcome = await resolveRoomGame(code);
    if (!outcome.game) {
      setError(resolveErrorText(outcome.reason));
      setSubmitting(false);
      return;
    }
    const game = outcome.game;
    setDetected(game);

    try {
      const res = await fetch(joinApi(game, code), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim() }),
      });
      if (!res.ok) {
        // Сервер присылает текст для 403/409 (бан, переполнено) — показываем его.
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (res.status === 404) setError(NOT_FOUND_TEXT);
        else if (res.status === 410) setError("Эта комната уже закрыта.");
        else setError(body?.error ?? "Не удалось войти");
        setSubmitting(false);
        return;
      }
      const data = (await res.json()) as JoinResponse;
      saveDisplayName(name.trim());
      saveRoomCreds({
        code: data.room.code,
        wsUrl: data.wsUrl,
        wsToken: data.wsToken,
        userId: data.user.id,
        displayName: data.user.displayName,
        game,
      });
      router.replace(roomPath(game, data.room.code));
    } catch {
      setError("Сеть/сервер недоступны");
      setSubmitting(false);
    }
  };

  // Пока выясняем, не сидим ли мы уже в этой комнате, форму не показываем:
  // иначе на секунду мелькает вопрос об имени, на который отвечать не нужно.
  if (resuming) {
    return (
      <MafiaShell>
        <div className="jn-wait">Входим в комнату…</div>
      </MafiaShell>
    );
  }

  // Возвращаемся туда, откуда пришли: с лендинга — на лендинг, с хаба — на хаб.
  const backHref = origin ? `/${origin}` : "/";
  const backLabel = origin === "mafia" ? "К Мафии" : origin === "alias" ? "К Алиасу" : "На главную";

  return (
    <MafiaShell>
      <div className="jn" data-game={accent ?? undefined}>
        <div className="mf-phase-head" style={{ paddingBottom: 4 }}>
          <button type="button" className="jn-back" onClick={() => router.push(backHref)}>
            <ArrowLeft size={20} />
            <span>{backLabel}</span>
          </button>
        </div>

        <div className="jn-body">
          <div className="jn-field">
            <div className="jn-label">Код комнаты</div>
            <input
              value={code}
              onChange={(e) => {
                const { code: next, wrongLayout: bad } = typeCode(e.target.value);
                setCode(next);
                setWrongLayout(bad);
                setError(null);
                // Код меняют — прежний ответ сервера к нему больше не относится.
                setDetected(null);
              }}
              // Вставку чиним молча: код мог быть скопирован уже в чужой раскладке.
              onPaste={(e) => {
                const pasted = pasteCode(e.clipboardData.getData("text"));
                if (!pasted) return;
                e.preventDefault();
                setCode(pasted);
                setWrongLayout(false);
                setError(null);
                setDetected(null);
              }}
              placeholder="K7F2QD"
              autoFocus
              className="mf-mono jn-code"
              aria-label="Код комнаты из шести символов"
            />
            {wrongLayout ? <div className="jn-err">{WRONG_LAYOUT_HINT}</div> : null}
          </div>

          <div className="jn-field">
            <div className="jn-label">Как тебя зовут?</div>
            <div className="jn-name">
              <MafiaAvatar name={name || "?"} idx={3} size={30} />
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 50))}
                placeholder="Твоё имя"
                maxLength={50}
                aria-label="Твоё имя"
              />
            </div>
          </div>

          {error ? <div className="jn-err">{error}</div> : null}

          {/* Код набран, игра известна — говорим, куда именно откроется дверь.
              Иначе зелёная страница, уводящая в Мафию, выглядит промахом. */}
          {detected && !error ? (
            <div className="jn-detected">
              {detected === "mafia" ? "Это комната Мафии" : "Это комната Алиаса"}
            </div>
          ) : null}
        </div>

        <div className="jn-foot">
          <button
            type="button"
            className="mf-btn jn-submit"
            style={{ opacity: full ? 1 : 0.5 }}
            disabled={submitting}
            onClick={submit}
          >
            {submitting ? "Входим…" : "Войти в комнату"} <ArrowRight size={19} />
          </button>
        </div>
      </div>
    </MafiaShell>
  );
}
