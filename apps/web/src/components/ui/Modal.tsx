"use client";

// Полупрозрачный fullscreen-overlay с диалогом.
// Используется для pause / confirm-end-round / reconnect.

import { useEffect } from "react";
import { X } from "lucide-react";
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
  maxWidth = 460,
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
      className="pause-overlay"
      onClick={() => {
        if (dismissOnBackdrop && onClose) onClose();
      }}
    >
      <div
        className={cn("card-glass", "w-full")}
        style={{
          boxShadow: "var(--shadow-pop)",
          padding: "clamp(28px, 3vw, 44px)",
          maxWidth: fullscreen ? "min(640px, 92vw)" : maxWidth,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-3 mb-4">
            {title && <h2 className="h-title">{title}</h2>}
            {onClose && (
              <button type="button" onClick={onClose} aria-label="Закрыть" className="icon-btn shrink-0">
                <X />
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
