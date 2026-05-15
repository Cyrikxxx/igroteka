import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "success" | "warn" | "danger" | "live";
  mono?: boolean;
}

export function Pill({ tone = "default", mono, className, style, children, ...rest }: PillProps) {
  const toneStyle: React.CSSProperties = (() => {
    switch (tone) {
      case "success":
        return { background: "var(--accent-soft)", color: "var(--accent)" };
      case "warn":
        return {
          background: "color-mix(in oklch, var(--warn) 18%, var(--bg-2))",
          color: "var(--warn)",
        };
      case "danger":
        return {
          background: "color-mix(in oklch, var(--danger) 18%, var(--bg-2))",
          color: "var(--danger)",
        };
      case "live":
        return {
          background: "color-mix(in oklch, var(--danger) 22%, var(--bg-2))",
          color: "var(--danger)",
        };
      default:
        return { background: "var(--bg-3)", color: "var(--fg-1)" };
    }
  })();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        mono && "font-mono uppercase tracking-wider",
        className,
      )}
      style={{ ...toneStyle, ...style }}
      {...rest}
    >
      {tone === "live" && (
        <span
          className="pulse inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: "var(--danger)" }}
        />
      )}
      {children}
    </span>
  );
}

export default Pill;
