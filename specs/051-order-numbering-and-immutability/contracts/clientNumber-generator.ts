/**
 * Контракт: атомарный генератор человекочитаемого номера заказа.
 *
 * Реализуется в `apps/web/src/lib/lifecycle/client-number.ts`
 * и вызывается из `Orders.js` beforeChange (operation=create).
 *
 * Гарантии:
 *  - При N одновременных вызовах из разных транзакций возвращаются N
 *    различных значений. Это обеспечено PG `SEQUENCE` + `nextval()`
 *    (см. data-model.md §2).
 *  - Year-компонент берётся в TZ `Europe/Moscow` (а не UTC) через
 *    `getBusinessYear(date, tz)`.
 *  - Если PG sequence для года ещё не существует, создаётся лениво:
 *    `CREATE SEQUENCE IF NOT EXISTS order_seq_${year} START 1` (C5).
 *  - При коллизии на уникальном индексе `orders.client_number`
 *    (защита от теоретического рассинхрона sequence ↔ table)
 *    делается до 3 повторов с jitter; на третий — log
 *    `OrderNumberGenerationFailed` и escalation (H6).
 *
 * Формат:  SO-YYYY-NNNN  (padStart до 4 знаков)
 *          SO-YYYY-NNNNN (без padding при n ≥ 10000) — FR-5103.
 */

import "server-only";
import type { Payload } from "payload";

export interface GenerateClientNumberOptions {
  /**
   * Логическая «сейчас». По умолчанию `new Date()`.
   * Используется только для определения year-компонента.
   */
  now?: Date;
  /**
   * Префикс — фиксирован как "SO" в MVP, оставлен для расширения
   * (если когда-нибудь понадобится разделение b2c/b2b).
   */
  prefix?: "SO";
  /**
   * Сколько раз повторить при коллизии unique-constraint.
   * Defaults to 3.
   */
  maxRetries?: number;
}

export interface ClientNumberResult {
  /** Готовый номер, например "SO-2026-0142". */
  clientNumber: string;
  /** Сырой счётчик, например 142. */
  sequenceValue: number;
  /** Year-компонент. */
  year: number;
  /** Имя PG sequence, использованного для генерации. */
  sequenceName: string;
}

/**
 * Сгенерировать следующий clientNumber.
 *
 * Должен вызываться внутри Payload-операции (т.е. payload.db.drizzle
 * доступен) либо c подключённой Pool — реализация инкапсулирует выбор.
 *
 * @throws {Error} если не удалось получить номер после maxRetries.
 */
export async function generateClientNumber(
  payload: Payload,
  options: GenerateClientNumberOptions = {},
): Promise<ClientNumberResult> {
  const _ = { payload, options };
  throw new Error("Not implemented: see apps/web/src/lib/lifecycle/client-number.ts");
}

/**
 * Извлечь year в заданном TZ. По умолчанию — Europe/Moscow.
 * Экспортируется для тестов и для backfill-скрипта, чтобы year-компонент
 * совпадал у генератора и у миграции.
 *
 * Renamed from getMoscowYear → getBusinessYear (L2) для расширяемости.
 */
export function getBusinessYear(date: Date, tz: string = "Europe/Moscow"): number {
  // Реализация-эталон (для тестов):
  // return Number(new Intl.DateTimeFormat("en-US", {
  //   timeZone: tz,
  //   year: "numeric",
  // }).format(date));
  const _ = { date, tz };
  throw new Error("Not implemented: see apps/web/src/lib/lifecycle/client-number.ts");
}

/** @deprecated Use getBusinessYear instead */
export const getMoscowYear = (date: Date): number => getBusinessYear(date, "Europe/Moscow");

/**
 * Форматирование счётчика в N-значное представление с auto-расширением.
 *
 * formatSequence(1)     === "0001"
 * formatSequence(142)   === "0142"
 * formatSequence(9999)  === "9999"
 * formatSequence(10000) === "10000"  // FR-5103
 */
export function formatSequence(n: number): string {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Invalid sequence value: ${n}`);
  }
  return n < 10000 ? String(n).padStart(4, "0") : String(n);
}

/**
 * Имя PG sequence для года.
 *
 * sequenceNameFor(2026) === "order_seq_2026"
 *
 * IMPORTANT (C5): Sequence создаётся lazy в beforeChange hook:
 *   `CREATE SEQUENCE IF NOT EXISTS ${sequenceNameFor(year)} START 1`
 * Не зависит от backfill или миграции — на стыке года новый sequence
 * создаётся автоматически первым заказом нового года.
 */
export function sequenceNameFor(year: number): string {
  return `order_seq_${year}`;
}

/**
 * Регулярка для валидации формата clientNumber.
 * Используется в тестах и в hook'е защиты от ручной правки без reissueReason.
 */
export const CLIENT_NUMBER_REGEX = /^SO-\d{4}-\d{4,}$/;
