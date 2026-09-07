// Контакт для связи с автором / поддержки.
// TODO: подставить реальный адрес, когда будет куплен домен и заведена почта.
export const SUPPORT_EMAIL = "support@example.com";

/**
 * Куда ведёт «Поддержка» в навигации. Пока почта — заглушка, письмо ушло бы в
 * никуда, поэтому кнопка ведёт в раздел контактов на «О нас»: там честно
 * написано, что связи ещё нет. Когда появится домен — вернуть supportMailto().
 */
export const SUPPORT_HREF = "/about#contacts";

/**
 * Публичная навигация платформы. Живёт здесь, а не в Nav.tsx: тот помечен
 * "use client", и серверные компоненты (страницы платформы) получили бы из
 * него не массив, а client-reference.
 */
export const NAV_LINKS: readonly { href: string; label: string }[] = [
  { href: "/about", label: "О нас" },
  { href: "/rules", label: "Правила" },
  { href: "/history", label: "История" },
];

/** mailto-ссылка с предзаполненной темой и шаблоном тела письма. */
export function supportMailto(): string {
  const subject = encodeURIComponent("Alias · обратная связь");
  const body = encodeURIComponent(
    "Опишите проблему или идею:\n\n\n---\nЧто делали перед ошибкой: \nРежим (онлайн/локально): \nУстройство/браузер: ",
  );
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}
