"use client";

// Вход в комнату Мафии по коду. POST /api/mafia/rooms/[code]/join → лобби.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { MafiaJoinRoomResponse } from "@alias/shared/mafia";
import MafiaShell from "@/components/mafia/MafiaShell";
import MafiaAvatar from "@/components/mafia/MafiaAvatar";
import {
  saveRoomCreds,
  saveDisplayName,
  loadDisplayName,
} from "@/lib/room-session";

export default function MafiaJoinPage() {
  return (
    <Suspense fallback={<MafiaShell><div /></MafiaShell>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(loadDisplayName());
    const fromUrl = searchParams.get("code");
    if (fromUrl) {
      setCode(fromUrl.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
    }
  }, [searchParams]);

  const full = code.length === 6 && name.trim().length > 0;

  const submit = async () => {
    if (!full) {
      setError(code.length !== 6 ? "Код из 6 символов" : "Введите имя");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/mafia/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim() }),
      });
      if (!res.ok) {
        // Сервер присылает текст для 403/409 (бан, переполнено) — показываем его.
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (res.status === 404) setError("Комната не найдена. Проверь код.");
        else if (res.status === 410) setError("Партия уже закончилась");
        else if (body?.error) setError(body.error);
        else setError("Не удалось войти");
        setSubmitting(false);
        return;
      }
      const data: MafiaJoinRoomResponse = await res.json();
      saveDisplayName(name.trim());
      saveRoomCreds({
        code: data.room.code,
        wsUrl: data.wsUrl,
        wsToken: data.wsToken,
        userId: data.user.id,
        displayName: data.user.displayName,
        game: "mafia",
      });
      router.replace(`/mafia/room/${data.room.code}`);
    } catch {
      setError("Сеть/сервер недоступны");
      setSubmitting(false);
    }
  };

  return (
    <MafiaShell>
      <div className="mf-phase-head" style={{ paddingBottom: 4 }}>
        <button
          type="button"
          className="mf-phase-title"
          style={{ background: "none", border: "none", color: "var(--mf-text)", cursor: "pointer", padding: 0 }}
          onClick={() => router.push("/")}
        >
          <ArrowLeft size={20} color="var(--mf-text-faint)" />
          <span style={{ fontSize: 18 }}>Вход в комнату</span>
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 24px",
          gap: 22,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--mf-text-faint)" }}>
            Код комнаты
          </div>
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
              setError(null);
            }}
            placeholder="K7F2QD"
            autoFocus
            className="mf-mono"
            style={{
              background: "var(--mf-surface)",
              border: "1.5px solid var(--mf-crimson)",
              borderRadius: "var(--r-btn)",
              padding: "16px 18px",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "0.3em",
              textAlign: "center",
              color: "var(--mf-text)",
              boxShadow: "0 0 24px rgba(225,29,72,0.15)",
              outline: "none",
              textTransform: "uppercase",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--mf-text-faint)" }}>
            Как тебя зовут?
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "var(--mf-surface)",
              border: "1.5px solid var(--mf-border)",
              borderRadius: "var(--r-btn)",
              padding: "12px 16px",
            }}
          >
            <MafiaAvatar name={name || "?"} idx={3} size={30} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              placeholder="Твоё имя"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--mf-text)",
                fontWeight: 700,
                fontSize: 17,
              }}
            />
          </div>
        </div>
        {error ? (
          <div style={{ color: "var(--mf-crimson)", fontSize: 13, fontWeight: 700 }}>{error}</div>
        ) : null}
      </div>

      <div style={{ padding: "0 20px 24px" }}>
        <button
          type="button"
          className="mf-btn mf-btn-crimson"
          style={{ width: "100%", opacity: full ? 1 : 0.5 }}
          disabled={submitting}
          onClick={submit}
        >
          {submitting ? "Входим…" : "Войти в комнату"} <ArrowRight size={19} />
        </button>
      </div>
    </MafiaShell>
  );
}
