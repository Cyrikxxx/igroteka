// Аватар-инициалы на цветном круге. Картинок нет — только инициалы.
// `color` — имя CSS-переменной команды ("--team-1") или любой CSS-цвет;
// по умолчанию — акцент. `online` рисует зелёную точку присутствия.

interface AvatarProps {
  name?: string | null;
  /** CSS-переменная команды ("--team-1") или произвольный цвет. */
  color?: string | null;
  size?: number;
  online?: boolean;
  className?: string;
}

function initials(name?: string | null): string {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Avatar({ name, color, size = 34, online, className }: AvatarProps) {
  const bg = color
    ? color.startsWith("--")
      ? `var(${color})`
      : color
    : "var(--accent)";
  return (
    <span className={"avatar-wrap" + (online ? " avatar-online" : "") + (className ? " " + className : "")}>
      <span className="avatar" style={{ "--sz": `${size}px`, background: bg } as React.CSSProperties}>
        {initials(name)}
      </span>
    </span>
  );
}

export default Avatar;
