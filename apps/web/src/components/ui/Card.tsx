import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Без тени. */
  flat?: boolean;
  /** Пунктирная граница. */
  dashed?: boolean;
}

export function Card({ flat, dashed, className, style, ...rest }: CardProps) {
  return (
    <div
      className={cn("card", className)}
      style={{
        ...(flat ? { boxShadow: "none" } : null),
        ...(dashed ? { border: "1px dashed var(--line-strong)" } : null),
        ...style,
      }}
      {...rest}
    />
  );
}

export default Card;
