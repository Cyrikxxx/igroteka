"use client";

import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, style, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-[42px] w-full px-3.5 rounded-[var(--r-md)] text-sm outline-none transition-shadow",
        "focus:shadow-[0_0_0_3px_var(--accent-soft)]",
        className,
      )}
      style={{
        background: "var(--bg-2)",
        color: "var(--fg)",
        border: "1px solid var(--line)",
        ...style,
      }}
      {...rest}
    />
  );
});

export default Input;
