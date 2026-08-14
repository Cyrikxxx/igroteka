// Настоящий сканируемый QR со ссылкой-приглашением.
// Используется лобби обеих игр: /alias/room/[code] и /mafia/room/[code].
// Раньше здесь была декоративная сетка из хеша строки — она не читалась
// ни одним сканером, хотя рядом стояла подпись «Сканируй, чтобы войти».

import { QRCodeSVG } from "qrcode.react";

interface QrCodeProps {
  /** Ссылка, которую кодируем. Пустая строка — до гидратации, ещё нет origin. */
  value?: string;
  className?: string;
}

export function QrCode({ value = "", className }: QrCodeProps) {
  return (
    <div className={"qr" + (className ? " " + className : "")}>
      {value ? (
        <QRCodeSVG
          value={value}
          // size задаёт viewBox; наружу SVG растягивает .qr svg { width: 100% }.
          size={256}
          bgColor="#ffffff"
          fgColor="#0a0d10"
          // Средний уровень коррекции: код читается, даже если экран
          // бликует или его снимают под углом.
          level="M"
          marginSize={0}
        />
      ) : null}
    </div>
  );
}

export default QrCode;
