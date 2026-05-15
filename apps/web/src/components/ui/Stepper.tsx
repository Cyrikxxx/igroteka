// Stepper для setup-flow: 1 → 2 → 3. См. DESIGN.md §3.18.

import { cn } from "@/lib/utils";

interface StepperProps {
  step: 1 | 2 | 3;
  labels?: [string, string, string];
}

const DEFAULT_LABELS: [string, string, string] = ["Команды", "Настройки", "Старт"];

export function Stepper({ step, labels = DEFAULT_LABELS }: StepperProps) {
  return (
    <ol className="flex items-center gap-2 md:gap-4 select-none">
      {labels.map((label, i) => {
        const idx = i + 1;
        const state =
          idx < step ? "done" : idx === step ? "active" : "todo";
        return (
          <li key={label} className="flex items-center gap-2 md:gap-3">
            <span
              className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full font-mono text-[11px] font-bold"
              style={
                state === "active"
                  ? { background: "var(--accent)", color: "var(--accent-fg)" }
                  : state === "done"
                  ? { background: "var(--accent-soft)", color: "var(--accent)" }
                  : { background: "var(--bg-2)", color: "var(--fg-3)" }
              }
            >
              {state === "done" ? "✓" : idx}
            </span>
            <span
              className="hidden md:inline text-[13px] font-semibold"
              style={{ color: state === "todo" ? "var(--fg-3)" : "var(--fg-1)" }}
            >
              {label}
            </span>
            {i < labels.length - 1 && (
              <span
                className="hidden md:inline-block w-8 h-px"
                style={{ background: "var(--line-strong)" }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default Stepper;
