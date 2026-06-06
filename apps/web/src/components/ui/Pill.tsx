import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "success" | "warn" | "danger" | "live";
  mono?: boolean;
}

const toneClass: Record<NonNullable<PillProps["tone"]>, string> = {
  default: "",
  success: "pill-accent",
  warn: "pill-warn",
  danger: "pill-live",
  live: "pill-live",
};

export function Pill({ tone = "default", mono, className, children, ...rest }: PillProps) {
  return (
    <span className={cn("pill", toneClass[tone], mono && "pill-mono", className)} {...rest}>
      {tone === "live" && <span className="dot dot-pulse" />}
      {children}
    </span>
  );
}

export default Pill;
