import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Игротека",
  description:
    "Алиас и Мафия — играть с друзьями за одним столом или онлайн. Без установки, без регистрации, в браузере",
};

// Сайт всегда чернильно-тёмный: и Алиас, и Мафия, и страницы платформы.
// Светлой темы нет, поэтому и переключателя, и no-flash-скрипта тоже нет.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ru"
      data-density="cozy"
      suppressHydrationWarning
      className={`${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
