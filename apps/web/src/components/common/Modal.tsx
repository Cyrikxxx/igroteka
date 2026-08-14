"use client";

// Полупрозрачный fullscreen-overlay с диалогом.
// Используется для pause / confirm-end-round / reconnect.

import { useEffect, useId, useRef } from "react";
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
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Esc закрывает (если onClose есть).
  useEffect(() => {
    if (!isOpen || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Пока диалог открыт, страница под ним не должна скроллиться, а Tab не
  // должен уводить фокус на кнопки за оверлеем.
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const focusable = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusable()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="pause-overlay"
      onClick={() => {
        if (dismissOnBackdrop && onClose) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
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
            {title && (
              <h2 className="h-title" id={titleId}>
                {title}
              </h2>
            )}
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
