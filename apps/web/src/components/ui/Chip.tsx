"use client";

import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function Chip({ active, className, style, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "h-[38px] px-4 rounded-full font-semibold text-sm transition-colors",
        className,
      )}
      style={{
        background: active ? "var(--accent)" : "var(--bg-2)",
        color: active ? "var(--accent-fg)" : "var(--fg-1)",
        border: active ? "1px solid var(--accent-line)" : "1px solid var(--line)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Chip;
