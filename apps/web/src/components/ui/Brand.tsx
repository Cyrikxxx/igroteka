// Логотип-марка приложения. Кликабельный — ведёт на главную.

import Link from "next/link";
import { Sparkles } from "lucide-react";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="alias.online — на главную">
      <div className="brand-mark">
        <Sparkles size={22} strokeWidth={2.2} />
      </div>
      <div className="brand-name">
        <b>
          alias<i>.online</i>
        </b>
        <span>v2.0 · realtime party</span>
      </div>
    </Link>
  );
}

export default Brand;
