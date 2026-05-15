import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  flat?: boolean;
  dashed?: boolean;
}

export function Card({ flat, dashed, className, style, ...rest }: CardProps) {
  return (
    <div
      className={cn("rounded-[var(--card-r)] p-[var(--density-pad)]", className)}
      style={{
        background: "var(--bg-1)",
        border: dashed ? "1px dashed var(--line-strong)" : "1px solid var(--line)",
        boxShadow: flat ? "none" : "var(--shadow-card)",
        ...style,
      }}
      {...rest}
    />
  );
}

export default Card;
