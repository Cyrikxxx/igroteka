// Stepper для setup-flow (по умолчанию 2 шага: Команды → Настройки).

import { Fragment } from "react";
import { cn } from "@/lib/utils";

interface StepperProps {
  step: 1 | 2 | 3;
  labels?: string[];
}

const DEFAULT_LABELS = ["Команды", "Настройки"];

export function Stepper({ step, labels = DEFAULT_LABELS }: StepperProps) {
  return (
    <ol className="steps">
      {labels.map((label, i) => {
        const idx = i + 1;
        const state = idx < step ? "done" : idx === step ? "active" : "todo";
        return (
          <Fragment key={label}>
            {i > 0 && <span className="step-sep" />}
            <li className={cn("step", state === "active" && "on", state === "done" && "done")}>
              <b>{state === "done" ? "✓" : idx}</b>
              {label}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

export default Stepper;
