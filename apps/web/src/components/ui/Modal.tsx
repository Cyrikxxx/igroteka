"use client";

// Полупрозрачный fullscreen-overlay с диалогом. См. DESIGN.md §5.9 (PauseScreen).
// Используется для pause / confirm-end-round / reconnect.

import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: number;
  /** Полноэкранный без max-width (для reconnect-overlay). */
  fullscreen?: boolean;
  /** Кликом по бэкдропу закрывать? Если false (или onClose не задан) — нет. */
  dismissOnBackdrop?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 360,
  fullscreen = false,
  dismissOnBackdrop = false,
}: ModalProps) {
  // Esc закрывает (если onClose есть).
  useEffect(() => {
    if (!isOpen || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={() => {
        if (dismissOnBackdrop && onClose) onClose();
      }}
    >
      <div
        className={cn(
          "rounded-[var(--r-lg)] p-6 w-full",
          fullscreen && "max-w-2xl",
        )}
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow-pop)",
          maxWidth: fullscreen ? undefined : maxWidth,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between mb-3 gap-3">
            {title && <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                className="w-8 h-8 rounded-md flex items-center justify-center text-sm shrink-0"
                style={{
                  background: "var(--bg-2)",
                  color: "var(--fg-3)",
                  border: "1px solid var(--line)",
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export default Modal;
