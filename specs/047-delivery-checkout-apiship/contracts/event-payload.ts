/**
 * Контракт payload'а доменных событий, эмитируемых `emitDomainEvent`.
 *
 * Источник: 047-delivery-checkout-apiship (FR-407, FR-412, FR-117, FR-118).
 * Этот контракт — обязательство 047 перед подписчиками (048-twenty-crm-sync, 049-customer-notifications).
 *
 * Реализация: apps/web/src/lib/lifecycle/events.ts
 */

/** Полный список доменных событий жизненного цикла. */
export type DomainEventKind =
  | "order.identified"           // клиент идентифицирован в чекауте (до создания Order)
  | "order.created"              // Order создан в Payload (любой type)
  | "order.invoice_issued"       // юрлицу выставлен счёт PDF
  | "order.paid"                 // webhook ЮKassa подтвердил оплату
  | "order.payment_failed"       // webhook ЮKassa: failed/cancel
  | "shipment.created"           // получен providerOrderId + trackingNumber
  | "shipment.in_transit"        // первая транзиция → in_transit
  | "shipment.at_point"          // первая транзиция → at_point
  | "shipment.courier_today"     // ApiShip → out for delivery
  | "shipment.delivered"         // первая транзиция → delivered
  | "shipment.returned"          // транзиция → returned
  | "shipment.error"             // shipment.status → error
  | "order.cancelled"            // Order → cancelled
  | "order.completed"            // cron auto-close (US7)
  | "order.stuck"                // cron alert: статус >stuckThresholdHours
  | "order.expired";             // awaiting_payment >invoiceExpiresDays

export interface DomainEventPayload {
  /** Идентификатор события (для idempotency). Формат: `{orderId}:{kind}:{sequence}`. */
  eventId: string;

  /** Тип события. */
  kind: DomainEventKind;

  /** Когда событие случилось. ISO-8601. Может отличаться от now() для webhook'ов. */
  at: string;

  /** Когда мы его получили/обработали. */
  emittedAt: string;

  /** Снимок Order (минимально достаточный для всех subscribers). */
  order: OrderSnapshot;

  /** Контекст события: предыдущий/новый статус, ошибки, дополнительные поля. */
  context?: EventContext;
}

export interface OrderSnapshot {
  id: string;
  publicToken: string;
  type: "physical" | "legal" | "quote";
  status: string;
  createdAt: string;

  customer: {
    fullName?: string;
    email?: string;
    phone?: string;
    companyName?: string;
    inn?: string;
    kpp?: string;
    secondaryEmails?: Array<{ email: string; role?: string }>;
    /** Согласие на SMS (выставляется на шаге Review). Будет жить в 049, но в snapshot — для удобства подписчиков. */
    smsOptIn?: boolean;
    marketingOptIn?: boolean;
  };

  totals: {
    subtotal: number;
    vat: number;
    deliveryCost: number;
    total: number;
    currency: "RUB";
  };

  delivery?: {
    provider: string;            // "apiship" | "fallback"
    providerKey?: string;        // "cdek" | "boxberry" | ...
    providerName?: string;
    label?: string;              // "СДЭК · до двери"
    tariffId?: number;
    deliveryType?: 1 | 2;
    pickupType?: 1 | 2;
    pointId?: string;
    pointAddress?: string;
    address?: string;
    city?: string;
    cost: number;
    etaMinDays?: number;
    etaMaxDays?: number;
    pickupExpiresAt?: string;    // для ПВЗ-тарифов
  };

  shipment?: {
    providerOrderId?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    labelUrl?: string;
    waybillUrl?: string;
    status: string;
  };

  items: Array<{
    sku: string;
    name?: string;
    quantity: number;
    unit: number;
    lineTotal: number;
  }>;

  /** Идентификаторы в Twenty (если 048 включена). */
  crmRefs?: {
    opportunityId?: string;
    personId?: string;
    companyId?: string;
  };
}

export interface EventContext {
  /** Для order.* событий со сменой статуса. */
  statusFrom?: string;
  statusTo?: string;

  /** Для shipment.* событий. */
  providerStatus?: string | number;
  trackingNumber?: string;
  trackingUrl?: string;

  /** Для shipment.error / order.stuck. */
  errorMessage?: string;

  /** Произвольные данные. */
  meta?: Record<string, unknown>;
}

/** Подписчик. Подписки регистрируются на старте приложения. */
export interface DomainEventSubscriber {
  /** Имя для логов: "email-stub", "twenty-crm-sync", "notifications-matrix". */
  name: string;

  /** Какие события слушает (если undefined — все). */
  kinds?: DomainEventKind[];

  /** Обработчик. MUST не бросать неперехваченные исключения наружу. */
  handle(event: DomainEventPayload): Promise<void> | void;
}

/** Контракт `emitDomainEvent`. */
export interface DomainEventEmitter {
  register(sub: DomainEventSubscriber): void;
  emit(event: DomainEventPayload): Promise<void>;
}
