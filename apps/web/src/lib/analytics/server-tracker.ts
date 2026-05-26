/**
 * Server-side tracker для Yandex.Metrika Measurement Protocol (058 T036).
 *
 * Используется в Order paid-hook чтобы отправить `purchase` event с сервера,
 * страхуя от adblock-блокировки клиентских пикселей (FR-040, US4).
 *
 * См. также:
 * - contracts/server-hit-endpoint.md
 * - research.md R3 (Measurement Protocol)
 *
 * Соответствие FR:
 * - FR-040: серверный duplicate of `purchase` event
 * - FR-042: client_id из cookie _ym_uid если был сохранён
 * - FR-043: respect consent на момент создания Order
 * - FR-044: fire-and-forget, errors не блокируют main flow
 * - FR-114: тот же transaction_id что в client purchase event
 */

const METRIKA_HIT_URL = "https://mc.yandex.ru/watch";
const USER_AGENT = "Soliton-AnalyticsAgent/1.0";

interface PurchaseHitArgs {
  counterId: string | number;
  /** _ym_uid из cookie на момент конверсии. Может быть undefined → Метрика создаст новый visitor */
  ymClientId?: string;
  /** Номер заказа = transaction_id (FR-114) */
  transactionId: string;
  /** Сумма в рублях */
  value: number;
  /** Полный URL success-page или PDP, где произошла конверсия */
  pageUrl: string;
  /** Optional IP клиента (для гео-атрибуции в Метрике) */
  clientIp?: string;
  /** Кастомные params для goal-attribution */
  extraParams?: Record<string, unknown>;
}

export interface ServerHitResult {
  status: "sent" | "skipped_no_consent" | "skipped_kill_switch" | "failed";
  statusCode?: number;
  error?: string;
  durationMs: number;
}

/**
 * Отправляет purchase hit через Метрика Measurement Protocol.
 *
 * fire-and-forget — caller НЕ ждёт promise (FR-044). Использовать `void` или
 * background-task pattern. На client-side НЕ работает (Metrika blocks
 * direct hits с frontend через CORS).
 */
export async function sendServerPurchase(args: PurchaseHitArgs): Promise<ServerHitResult> {
  const start = Date.now();

  try {
    // Build URL with all params
    const url = new URL(METRIKA_HIT_URL + "/" + args.counterId);

    // Standard params
    url.searchParams.set("page-url", args.pageUrl);
    url.searchParams.set("cnt-class", "7"); // server-side hit (R3)
    url.searchParams.set("ut", "noindex");

    if (args.ymClientId) {
      url.searchParams.set("ymid", args.ymClientId);
    }

    // Goal params encoded в `params` (URL-encoded JSON)
    const goalParams = {
      transaction_id: args.transactionId,
      value: args.value,
      currency: "RUB",
      source: "server-side",
      ...args.extraParams,
    };
    url.searchParams.set("params", JSON.stringify(goalParams));

    // Fire hit with 1.5s timeout (FR-044)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          ...(args.clientIp ? { "X-Real-IP": args.clientIp } : {}),
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const durationMs = Date.now() - start;
    if (response.ok) {
      return { status: "sent", statusCode: response.status, durationMs };
    }
    return {
      status: "failed",
      statusCode: response.status,
      error: `HTTP ${response.status}`,
      durationMs,
    };
  } catch (err) {
    return {
      status: "failed",
      error: (err as Error).message ?? String(err),
      durationMs: Date.now() - start,
    };
  }
}
