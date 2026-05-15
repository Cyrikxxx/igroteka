"use client";

import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  id?: string;
}

export function Toggle({ checked, onChange, label, id }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className="inline-flex items-center gap-3 cursor-pointer select-none"
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-[38px] h-[22px] rounded-full transition-colors",
        )}
        style={{
          background: checked ? "var(--accent)" : "var(--bg-3)",
          border: "1px solid var(--line)",
        }}
      >
        <span
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white transition-[left] duration-150"
          style={{ left: checked ? "19px" : "3px" }}
        />
      </button>
      {label && <span className="text-sm" style={{ color: "var(--fg-1)" }}>{label}</span>}
    </label>
  );
}

export default Toggle;
