/**
 * Error code → russian-string mapping for payment UI (056 T006).
 *
 * Source: data-model.md §3 + FR-5605/5606/5625.
 * OQ-4 resolved: code→UI-string dictionary, backend body.message — fallback.
 */

export interface PaymentErrorString {
  title: string;
  description: string;
  /** Suggested CTA label. */
  ctaLabel: string;
  /**
   * Suggested CTA href. Empty string => caller should populate dynamically
   * (e.g. from Order.publicToken).
   */
  ctaHref: string;
}

export const PAYMENT_ERROR_STRINGS: Record<string, PaymentErrorString> = {
  YOOKASSA_UNAVAILABLE: {
    title: "Платёжная система временно недоступна",
    description:
      "Попробуйте через 1-2 минуты. Если проблема повторяется — свяжитесь с нами.",
    ctaLabel: "Вернуться в корзину",
    ctaHref: "/cart/",
  },
  YOOKASSA_REJECTED: {
    title: "Платёж отклонён",
    description:
      "Возможные причины: недостаточно средств, ограничения банка. Попробуйте другую карту или метод оплаты.",
    ctaLabel: "Попробовать снова",
    ctaHref: "",
  },
  CONFIG_INVALID: {
    title: "Ошибка конфигурации платёжной системы",
    description: "Мы уже знаем о проблеме и работаем над ней. Заказ не создан.",
    ctaLabel: "На главную",
    ctaHref: "/",
  },
  INVALID_ORDER_STATUS: {
    title: "Заказ нельзя оплатить повторно",
    description: "Этот заказ уже оплачен либо аннулирован.",
    ctaLabel: "Открыть заказ",
    ctaHref: "",
  },
  AMOUNT_MISMATCH: {
    title: "Несоответствие суммы",
    description: "Мы свяжемся с вами в течение часа для разбирательства.",
    ctaLabel: "На главную",
    ctaHref: "/",
  },
  VALIDATION_FAILED: {
    title: "Ошибка валидации",
    description: "Проверьте корректность данных заказа и попробуйте снова.",
    ctaLabel: "Вернуться в корзину",
    ctaHref: "/cart/",
  },
  ORDER_NOT_FOUND: {
    title: "Заказ не найден",
    description: "Возможно, ссылка устарела или была повреждена.",
    ctaLabel: "В каталог",
    ctaHref: "/catalog/",
  },
  FORBIDDEN: {
    title: "Не удалось проверить вашу сессию",
    description:
      "Войдите в личный кабинет или откройте ссылку из письма с подтверждением.",
    ctaLabel: "Войти",
    ctaHref: "/me/login",
  },
  DISABLED: {
    title: "Приём платежей временно приостановлен",
    description: "Свяжитесь с нами для оформления заказа другим способом.",
    ctaLabel: "На главную",
    ctaHref: "/",
  },
  PARSE_ERROR: {
    title: "Что-то пошло не так",
    description: "Если деньги уже списались, мы пришлём подтверждение email-ом.",
    ctaLabel: "На главную",
    ctaHref: "/",
  },
  INTERNAL_ERROR: {
    title: "Внутренняя ошибка",
    description: "Если деньги уже списались, мы пришлём подтверждение email-ом.",
    ctaLabel: "На главную",
    ctaHref: "/",
  },
  UNKNOWN: {
    title: "Что-то пошло не так",
    description: "Если деньги уже списались, мы пришлём подтверждение email-ом.",
    ctaLabel: "На главную",
    ctaHref: "/",
  },
};

/**
 * Resolve error code → UI strings. Falls back to UNKNOWN if code missing
 * or not registered.
 */
export function resolvePaymentError(
  code: string | null | undefined,
): PaymentErrorString {
  if (!code) return PAYMENT_ERROR_STRINGS.UNKNOWN!;
  return PAYMENT_ERROR_STRINGS[code] ?? PAYMENT_ERROR_STRINGS.UNKNOWN!;
}
