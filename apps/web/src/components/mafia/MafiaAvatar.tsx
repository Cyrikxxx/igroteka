// Аватар-кружок с первой буквой имени. Палитра по индексу (из дизайна Мафии).
//
// Два независимых признака, и путать их нельзя:
//
//   • жив ли человек — цвет самого кружка; погибший серый;
//   • есть ли связь — точка в углу, серая когда человек не в сети.
//
// Раньше оффлайн тоже гасил весь кружок, и живой с моргнувшим Wi-Fi выглядел
// ровно как убитый. А у погибшего точка не рисовалась вовсе — по мёртвому
// нельзя было понять, сидит он ещё за столом или закрыл вкладку.

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
  /** Не в сети: в углу серая точка. Сам кружок при этом не гаснет. */
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
        background: dead ? "#2a2a33" : bg,
        color: dead ? "#8b8c98" : "rgba(255,255,255,0.92)",
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
      {/* Точка связи. Рисуется и у погибшего: стол должен видеть, кто ещё
          здесь, а кто ушёл, — от этого зависит, ждать его или заканчивать. */}
      {offline ? (
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
