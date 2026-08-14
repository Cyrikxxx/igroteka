"use client";

import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  id?: string;
}

// <label htmlFor> нельзя привязать к <button> — такая пара невалидна, и
// клик по подписи ничего не переключал. Теперь подпись живёт внутри самой
// кнопки-переключателя, поэтому нажимается вся строка целиком.
export function Toggle({ checked, onChange, label, id }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-3 cursor-pointer select-none bg-transparent border-0 p-0"
    >
      <span className={cn("toggle", checked && "on")} aria-hidden="true" />
      {label && (
        <span className="text-sm" style={{ color: "var(--fg-1)" }}>
          {label}
        </span>
      )}
    </button>
  );
}

export default Toggle;
