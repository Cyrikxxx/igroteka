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
  offline = false,
}: {
  name: string;
  idx?: number;
  size?: number;
  dead?: boolean;
  /** Не в сети: аватар гаснет, в углу серая точка. */
  offline?: boolean;
}) {
  const bg = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  const dot = Math.max(9, Math.round(size * 0.26));
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        background: dead ? "#2a2a33" : offline ? "#3a3b45" : bg,
        color: dead || offline ? "#8b8c98" : "rgba(255,255,255,0.92)",
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
      {/* Метка «не в сети» — только у живых: у погибшего свои приметы, и две
          пометки на одном кружке читаются как одна ошибка. */}
      {offline && !dead ? (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: dot,
            height: dot,
            borderRadius: "50%",
            background: "#62636e",
            border: "2px solid var(--mf-bg)",
          }}
        />
      ) : null}
    </div>
  );
}
