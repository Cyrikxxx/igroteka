// Код комнаты крупными моно-ячейками (.code-chunk). `xl` — увеличенный вариант.

interface RoomCodeProps {
  code: string;
  size?: "md" | "xl";
  className?: string;
}

export function RoomCode({ code, size = "md", className }: RoomCodeProps) {
  return (
    <div className={"code-chunk" + (size === "xl" ? " xl" : "") + (className ? " " + className : "")}>
      {code.split("").map((c, i) => (
        <span key={i}>{c}</span>
      ))}
    </div>
  );
}

export default RoomCode;
