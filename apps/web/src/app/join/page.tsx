"use client";

// Вход в комнату по коду. См. DESIGN.md §5.4.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/ui/Header";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import {
  saveRoomCreds,
  saveDisplayName,
  loadDisplayName,
} from "@/lib/room-session";
import type { JoinRoomResponse } from "@/types";

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(loadDisplayName());
    // Префилл кода из ?code=ABCDEF (приходит по copy-link из лобби хоста).
    const fromUrl = searchParams.get("code");
    if (fromUrl) {
      const cleaned = fromUrl.trim().toUpperCase().slice(0, 6);
      if (cleaned) setCode(cleaned);
    }
  }, [searchParams]);

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const normalizedCode = code.trim().toUpperCase();
    const normalizedName = name.trim();
    if (normalizedCode.length !== 6) {
      setError("Код должен быть из 6 символов");
      return;
    }
    if (!normalizedName) {
      setError("Введите ник");
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
        if (res.status === 404) setError("Комната не найдена");
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
      router.replace(`/room/${data.room.code}`);
    } catch {
      setError("Сеть/сервер недоступен");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-md px-4 md:px-8 py-12">
        <div className="eyebrow mb-3">JOIN A GAME</div>
        <h1 className="h-display mb-8">Введите код<br />комнаты</h1>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="code"
              className="eyebrow block mb-2"
            >
              КОД
            </label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABCDEF"
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 22,
                letterSpacing: "0.18em",
                textAlign: "center",
              }}
            />
          </div>
          <div>
            <label
              htmlFor="name"
              className="eyebrow block mb-2"
            >
              ВАШ НИК
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              placeholder="Например, Маша"
              maxLength={50}
            />
          </div>

          {error && (
            <div
              className="p-3 rounded-md text-sm"
              style={{
                background: "color-mix(in oklch, var(--danger) 12%, var(--bg-2))",
                color: "var(--danger)",
                border: "1px solid color-mix(in oklch, var(--danger) 30%, transparent)",
              }}
            >
              {error}
            </div>
          )}

          <Button block size="lg" type="submit" disabled={submitting}>
            {submitting ? "Входим…" : "Войти в комнату"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => router.push("/")}
          >
            ← На главную
          </Button>
        </form>
      </main>
    </div>
  );
}
