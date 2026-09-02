"use client";

// Подтверждение опасного действия внутри страницы.
//
// Раньше тут стоял window.confirm — системное окно «Подтвердите действие на
// сайте localhost». Оно выпадает из оформления, по-разному выглядит в каждом
// браузере и в мобильных вкладках умеет блокировать страницу целиком.
//
// Спрашиваем только там, где отменить уже нельзя: закрыть комнату, удалить
// партию, оборвать раунд. Кик и передача хоста обратимы — они делаются сразу,
// без вопросов.

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel = "Да",
  cancelLabel = "Отмена",
  variant = "alias",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  text?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** У Мафии своя палитра, она не зависит от темы Алиаса. */
  variant?: "alias" | "mafia";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onCancel]);

  if (!open) return null;
  const mafia = variant === "mafia";

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        className={"confirm-box" + (mafia ? " mf" : "")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-head">
          <span className="confirm-ic">
            <AlertTriangle size={20} />
          </span>
          <h2 className="confirm-title">{title}</h2>
        </div>
        {text ? <p className="confirm-text">{text}</p> : null}
        <div className="confirm-actions">
          <button type="button" className="confirm-btn ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="confirm-btn danger" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
