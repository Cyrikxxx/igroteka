// Детерминированный QR-подобный SVG (декоративный, но стабильный по value).
// Расчёт чистый → безопасен для SSR. В проде заменить на реальный генератор
// (напр. qrcode.react), если нужен сканируемый код.

interface QrCodeProps {
  value?: string;
  cells?: number;
  className?: string;
}

function buildGrid(value: string, cells: number): number[][] {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  const rng = () => {
    h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
  const m: number[][] = Array.from({ length: cells }, () => Array(cells).fill(0));
  const finder = (r: number, c: number) => {
    for (let i = -1; i <= 7; i++)
      for (let j = -1; j <= 7; j++) {
        const rr = r + i, cc = c + j;
        if (rr < 0 || cc < 0 || rr >= cells || cc >= cells) continue;
        const border = i === 0 || i === 6 || j === 0 || j === 6;
        const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        m[rr][cc] =
          i >= 0 && i <= 6 && j >= 0 && j <= 6 && (border || core)
            ? 1
            : i === -1 || i === 7 || j === -1 || j === 7
              ? 0
              : m[rr][cc];
      }
  };
  for (let r = 0; r < cells; r++)
    for (let c = 0; c < cells; c++) {
      if ((r < 8 && c < 8) || (r < 8 && c >= cells - 8) || (r >= cells - 8 && c < 8)) continue;
      m[r][c] = rng() > 0.55 ? 1 : 0;
    }
  finder(0, 0);
  finder(0, cells - 7);
  finder(cells - 7, 0);
  return m;
}

export function QrCode({ value = "", cells = 21, className }: QrCodeProps) {
  const grid = buildGrid(value, cells);
  const s = 100 / cells;
  return (
    <div className={"qr" + (className ? " " + className : "")}>
      <svg viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#fff" />
        {grid.map((row, r) =>
          row.map((v, c) =>
            v ? (
              <rect key={`${r}-${c}`} x={c * s} y={r * s} width={s * 1.02} height={s * 1.02} fill="#0a0d10" />
            ) : null,
          ),
        )}
      </svg>
    </div>
  );
}

export default QrCode;
