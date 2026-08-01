// Контакт для связи с автором / поддержки.
// TODO: подставить реальный адрес, когда будет куплен домен и заведена почта.
export const SUPPORT_EMAIL = "support@example.com";

/** mailto-ссылка с предзаполненной темой и шаблоном тела письма. */
export function supportMailto(): string {
  const subject = encodeURIComponent("Alias · обратная связь");
  const body = encodeURIComponent(
    "Опишите проблему или идею:\n\n\n---\nЧто делали перед ошибкой: \nРежим (онлайн/локально): \nУстройство/браузер: ",
  );
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}
