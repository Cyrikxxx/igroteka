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

const sizeClass: Record<Size, string> = { sm: "btn-sm", md: "", lg: "btn-lg" };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block = false, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn("btn", `btn-${variant}`, sizeClass[size], block && "btn-block", className)}
      {...rest}
    >
      {children}
    </button>
  );
});

export default Button;
