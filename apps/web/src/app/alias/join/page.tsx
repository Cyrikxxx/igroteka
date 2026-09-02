"use client";

// Вход в комнату по коду. Дизайн — JoinScreen из редизайна (6-значные ячейки).
// Логика реальная: POST /api/rooms/[code]/join → saveRoomCreds → лобби.

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Hash, X } from "lucide-react";
import AppShell from "@/components/common/AppShell";
import { saveRoomCreds, saveDisplayName, loadDisplayName } from "@/lib/room-session";
import { resumeRoom } from "@/lib/room-resume";
import {
  ROOM_CODE_LENGTH,
  WRONG_LAYOUT_HINT,
  pasteCode,
  typeCode,
} from "@/lib/room-code-input";
import type { JoinRoomResponse } from "@/types";

export default function JoinPage() {
  return (
    <Suspense fallback={<JoinFallback />}>
      <JoinPageInner />
    </Suspense>
  );
}

function JoinFallback() {
  return (
    <AppShell centered>
      <p className="muted" style={{ textAlign: "center" }}>
        Загрузка…
      </p>
    </AppShell>
  );
}

function JoinPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wrongLayout, setWrongLayout] = useState(false);
  const [resuming, setResuming] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setName(loadDisplayName());
    // Префилл кода из ?code=ABCDEF (приходит по copy-link из лобби хоста).
    const fromUrl = searchParams.get("code");
    if (!fromUrl) return;
    const cleaned = pasteCode(fromUrl.trim());
    if (!cleaned) return;
    setCode(Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => cleaned[i] ?? ""));

    // Пришли по ссылке в комнату, где уже сидим, — имя спрашивать не за чем.
    if (cleaned.length !== ROOM_CODE_LENGTH) return;
    setResuming(true);
    let alive = true;
    resumeRoom(cleaned, "alias").then((resumed) => {
      if (!alive) return;
      if (resumed) router.replace(`/alias/room/${resumed.code}`);
      else setResuming(false);
    });
    return () => {
      alive = false;
    };
  }, [searchParams, router]);

  const setChar = (i: number, v: string) => {
    const { code: cleaned, wrongLayout } = typeCode(v);
    const c = cleaned.slice(-1);
    setWrongLayout(wrongLayout);
    if (wrongLayout) return; // буквы чужой раскладки в поле не пускаем
    setCode((prev) => {
      const next = [...prev];
      next[i] = c;
      return next;
    });
    setError(null);
    if (c && i < ROOM_CODE_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[i] && i > 0) refs.current[i - 1]?.focus();
  };

  // Вставку чиним молча: код мог быть скопирован уже в чужой раскладке.
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = pasteCode(e.clipboardData.getData("text"));
    if (!text) return;
    e.preventDefault();
    setCode(Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => text[i] ?? ""));
    setError(null);
    setWrongLayout(false);
    refs.current[Math.min(text.length, ROOM_CODE_LENGTH - 1)]?.focus();
  };

  const full = code.every(Boolean) && name.trim().length > 0;

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const normalizedCode = code.join("").toUpperCase();
    const normalizedName = name.trim();
    if (normalizedCode.length !== 6) {
      setError("Введите код из 6 символов");
      return;
    }
    if (!normalizedName) {
      setError("Введите имя");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${normalizedCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: normalizedName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 404) setError("Комната не найдена. Проверь код.");
        else if (res.status === 410) setError("Комната уже закончилась");
        else if (res.status === 409) setError("Игра уже идёт — войти нельзя");
        else setError(body?.error ?? "Не удалось войти");
        setSubmitting(false);
        return;
      }
      const data: JoinRoomResponse = await res.json();
      saveDisplayName(normalizedName);
      saveRoomCreds({
        code: data.room.code,
        wsUrl: data.wsUrl,
        wsToken: data.wsToken,
        userId: data.user.id,
        displayName: data.user.displayName,
      });
      router.replace(`/alias/room/${data.room.code}`);
    } catch {
      setError("Сеть/сервер недоступен");
      setSubmitting(false);
    }
  };

  // Пока выясняем, не сидим ли мы уже в этой комнате, форму не показываем:
  // иначе на секунду мелькает вопрос об имени, на который отвечать не нужно.
  if (resuming) {
    return (
      <AppShell centered>
        <p className="muted" style={{ textAlign: "center" }}>
          Входим в комнату…
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell centered className="screen-anim">
      <div className="form-narrow">
        <button type="button" className="back-link" onClick={() => router.push("/alias")}>
          <ArrowLeft /> К Алиасу
        </button>

        <form className="card form-card" onSubmit={onSubmit}>
          <div className="form-head">
            <span className="form-ic">
              <Hash size={26} />
            </span>
            <div>
              <h1 className="h-title">Войти в комнату</h1>
              <p className="h-sub">
                Введи 6-значный код, который дал хост, или открой ссылку-приглашение.
              </p>
            </div>
          </div>

          <label className="field-label">Код комнаты</label>
          <div className="join-code">
            {code.map((c, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className={"join-cell" + (error ? " err" : "")}
                value={c}
                onChange={(e) => setChar(i, e.target.value)}
                onKeyDown={(e) => onKey(i, e)}
                onPaste={onPaste}
                inputMode="text"
                maxLength={1}
                autoComplete="off"
                spellCheck={false}
                aria-label={`символ ${i + 1}`}
              />
            ))}
          </div>
          {wrongLayout && <p className="code-layout-hint">{WRONG_LAYOUT_HINT}</p>}
          {error && (
            <p className="join-err">
              <X size={15} /> {error}
            </p>
          )}

          <label className="field-label" style={{ marginTop: 22 }}>
            Твоё имя
          </label>
          <input
            className="input"
            placeholder="Например, Аня"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 50))}
            maxLength={50}
          />

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block"
            style={{ marginTop: 22 }}
            disabled={submitting || !full}
          >
            {submitting ? "Входим…" : "Войти"} <ArrowRight />
          </button>
        </form>
      </div>
    </AppShell>
  );
}
