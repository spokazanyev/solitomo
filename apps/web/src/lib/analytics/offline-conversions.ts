/**
 * Yandex.Metrika Offline Conversions API integration (058 T089).
 *
 * Соответствие спеке 058:
 * - FR-033: offline-conversion с привязкой к yclid (для Я.Директ post-click)
 * - FR-034: fallback на client_id если yclid отсутствует
 *
 * НЕ путать с server-hit (FR-040, server-tracker.ts):
 * - server-hit отправляет regular event для adblock-resilience
 * - offline-conversion — отдельный API для исторических связок с Директ
 *
 * Endpoint: POST /management/v1/counter/{id}/offline_conversions/upload
 * Format: CSV multipart upload
 *
 * См. также: docs.yandex.ru/dev/metrika/ru/management/openapi/offlineConversions
 */

const OFFLINE_API_URL = "https://api-metrika.yandex.net/management/v1/counter";
const USER_AGENT = "Soliton-AnalyticsAgent/1.0";

interface OfflineConversionArgs {
  counterId: string | number;
  /** OAuth-token с counter-management scope (YM_AGENT_TOKEN) */
  apiToken: string;
  /** target goal name (e.g. 'purchase') */
  goalId: string;
  /** transaction id = order.clientNumber (FR-114) */
  transactionId: string;
  /** Сумма в рублях */
  value: number;
  /** ISO8601 timestamp — paid time */
  dateTime: string;
  /** Required: один из yclid или clientId */
  yclid?: string;
  clientId?: string;
}

export interface OfflineConversionResult {
  status: "sent" | "skipped_no_yclid" | "failed";
  statusCode?: number;
  error?: string;
  durationMs: number;
}

/**
 * Upload single conversion. CSV body с одной строкой.
 *
 * Yandex Metrika CSV format для offline_conversions:
 * `UserId,Target,DateTime,Price,Currency` (если ClientId-based)
 * `yclid,Target,DateTime,Price,Currency` (если yclid-based)
 */
export async function sendOfflineConversion(
  args: OfflineConversionArgs,
): Promise<OfflineConversionResult> {
  const start = Date.now();

  if (!args.yclid && !args.clientId) {
    return { status: "skipped_no_yclid", durationMs: Date.now() - start };
  }

  // Choose CSV format based on available identifier
  const useYclid = Boolean(args.yclid);
  const headerRow = useYclid
    ? "yclid,Target,DateTime,Price,Currency"
    : "ClientId,Target,DateTime,Price,Currency";
  const dataRow = [
    useYclid ? args.yclid : args.clientId,
    args.goalId,
    args.dateTime,
    String(args.value),
    "RUB",
  ].join(",");
  const csv = `${headerRow}\n${dataRow}\n`;

  const url = `${OFFLINE_API_URL}/${args.counterId}/offline_conversions/upload?client_id_type=${useYclid ? "YCLID" : "CLIENT_ID"}`;

  try {
    const formData = new FormData();
    const blob = new Blob([csv], { type: "text/csv" });
    formData.append("file", blob, "conversion.csv");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `OAuth ${args.apiToken}`,
          "User-Agent": USER_AGENT,
        },
        body: formData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const durationMs = Date.now() - start;
    if (response.ok) {
      return { status: "sent", statusCode: response.status, durationMs };
    }

    const text = await response.text().catch(() => "");
    return {
      status: "failed",
      statusCode: response.status,
      error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
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
