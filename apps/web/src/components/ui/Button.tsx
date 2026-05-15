"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const sizeClasses: Record<Size, string> = {
  sm: "h-[34px] px-3 text-[13px] rounded-[var(--r-sm)]",
  md: "h-11 px-5 text-sm rounded-[var(--r-md)]",
  lg: "h-[54px] px-6 text-base rounded-[var(--r-lg)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block = false, className, style, children, ...rest },
  ref,
) {
  const variantStyle: React.CSSProperties = (() => {
    switch (variant) {
      case "primary":
        return { background: "var(--accent)", color: "var(--accent-fg)" };
      case "secondary":
        return {
          background: "var(--bg-2)",
          color: "var(--fg)",
          border: "1px solid var(--line-strong)",
        };
      case "ghost":
        return { background: "transparent", color: "var(--fg-1)" };
      case "danger":
        return { background: "var(--danger)", color: "#fff" };
    }
  })();

  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-[transform,background,border-color] duration-150 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed",
        sizeClasses[size],
        block && "w-full",
        className,
      )}
      style={{ ...variantStyle, ...style }}
      {...rest}
    >
      {children}
    </button>
  );
});

export default Button;
