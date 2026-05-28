/**
 * PII filter для analytics events (FR-060, FR-062).
 *
 * Все event-helpers ОБЯЗАНЫ прогонять payload через `scrubPII()` перед push'ем
 * в dataLayer. Это последний рубеж защиты: даже если разработчик случайно
 * передаст email/phone/ИНН/комментарий — фильтр их вырежет.
 *
 * Соответствие спеке 058:
 * - FR-060: webvisor маски для форм с ПДн (data-yandex-metrika-mask)
 * - FR-062: параметры событий MUST НЕ содержать ПДн
 * - research.md R10: алгоритм фильтра
 *
 * Стратегия (defence-in-depth):
 * - **Black-list keys**: `comment`, `description`, `task`, `notes`, `message`,
 *   `text`, `email`, `phone`, `inn`, `fio`, `name_full` — целиком вырезаются.
 * - **Regex masks**: email / phone / ИНН в любых string-значениях → [REDACTED_*].
 * - **Whitelist keys**: `search_term`, `acquisition_query` — оставляются, но
 *   прогоняются через regex (поиск может содержать ПДн случайно).
 * - **Depth limit**: рекурсия ≤5 уровней (защита от циклических объектов).
 * - **Debug mode**: при `NEXT_PUBLIC_ANALYTICS_DEBUG=true` пишет в console какие
 *   ключи/значения замаскированы — для отлова утечек на dev.
 */

const EMAIL_REGEX = /[\w._%+-]+@[\w.-]+\.\w{2,}/g;
const PHONE_REGEX = /\+?[\d\s\-()]{10,}/g;
const INN_REGEX = /\b\d{10}(\d{2})?\b/g;

const BLACK_LIST_KEYS = new Set([
  "comment",
  "description",
  "task",
  "notes",
  "message",
  "text",
  "email",
  "phone",
  "phone_number",
  "tel",
  "inn",
  "kpp",
  "ogrn",
  "fio",
  "name_full",
  "first_name",
  "last_name",
  "middle_name",
  "patronymic",
  "address",
  "passport",
]);

// Keys, которые ОСТАЮТСЯ но прогоняются через regex masks
const SCRUB_VALUE_KEYS = new Set([
  "search_term",
  "acquisition_query",
  "error_message", // FR-170 — js_error.error_message может случайно содержать PII
]);

const MAX_DEPTH = 5;

interface ScrubStats {
  blackListedKeys: number;
  emailMasked: number;
  phoneMasked: number;
  innMasked: number;
}

function debugEnabled(): boolean {
  if (typeof process === "undefined") return false;
  return process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true";
}

/**
 * Pure-функция: возвращает новый объект без ПДн.
 * Не мутирует input.
 */
export function scrubPII<T extends Record<string, unknown>>(payload: T): Record<string, unknown> {
  const stats: ScrubStats = { blackListedKeys: 0, emailMasked: 0, phoneMasked: 0, innMasked: 0 };
  const result = scrubValue(payload, 0, stats) as Record<string, unknown>;

  if (debugEnabled() && (stats.blackListedKeys || stats.emailMasked || stats.phoneMasked || stats.innMasked)) {
    // eslint-disable-next-line no-console
    console.warn("[pii-filter]", stats);
  }

  return result;
}

function scrubValue(value: unknown, depth: number, stats: ScrubStats): unknown {
  if (depth >= MAX_DEPTH) return undefined;
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return scrubString(value, stats);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1, stats));
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();

      // Black-list — целиком вырезаем
      if (BLACK_LIST_KEYS.has(lowerKey)) {
        stats.blackListedKeys += 1;
        continue;
      }

      // Whitelist — оставляем, но scrub value через masks
      if (SCRUB_VALUE_KEYS.has(lowerKey) && typeof obj[key] === "string") {
        result[key] = scrubString(obj[key] as string, stats);
        continue;
      }

      // Иначе — рекурсивный scrub
      result[key] = scrubValue(obj[key], depth + 1, stats);
    }
    return result;
  }

  // Неизвестный type — null'им (functions, symbols, etc.)
  return undefined;
}

function scrubString(s: string, stats: ScrubStats): string {
  let out = s;

  // ИНН первым (он узкий — exactly 10 or 12 digits)
  if (INN_REGEX.test(out)) {
    out = out.replace(INN_REGEX, "[REDACTED_INN]");
    stats.innMasked += 1;
  }

  if (EMAIL_REGEX.test(out)) {
    out = out.replace(EMAIL_REGEX, "[REDACTED_EMAIL]");
    stats.emailMasked += 1;
  }

  // Phone — последним (regex broad, может ложно срабатывать на длинных числах)
  // Сначала проверяем что не уже [REDACTED_...]
  if (PHONE_REGEX.test(out) && !out.includes("[REDACTED_INN]")) {
    out = out.replace(PHONE_REGEX, (match) => {
      // Heuristic: фильтр оставляет ≥10 цифр; убираем false-positives для коротких чисел
      const digits = match.replace(/\D/g, "");
      if (digits.length >= 10) {
        stats.phoneMasked += 1;
        return "[REDACTED_PHONE]";
      }
      return match;
    });
  }

  return out;
}
