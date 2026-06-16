// Аватар-кружок с первой буквой имени. Палитра по индексу (из дизайна Мафии).

const AVATAR_COLORS = [
  "#7f5af0",
  "#2cb1bc",
  "#d97706",
  "#5a8dee",
  "#c2557e",
  "#5fa052",
  "#9a6dd7",
  "#c97b4a",
  "#557fc2",
];

export default function MafiaAvatar({
  name,
  idx = 0,
  size = 44,
  dead = false,
}: {
  name: string;
  idx?: number;
  size?: number;
  dead?: boolean;
}) {
  const bg = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: dead ? "#2a2a33" : bg,
        color: dead ? "#62636e" : "rgba(255,255,255,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.42,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {(name?.[0] ?? "?").toUpperCase()}
    </div>
  );
}
