/**
 * Safety invariants для agent-driven Metrika операций.
 *
 * Соответствие спеке 058:
 * - FR-391: NEVER hard-delete без explicit confirmationFlag
 * - FR-392: NEVER менять critical-settings без approved proposal
 * - FR-393: rate-limiting + backoff
 * - FR-395: circuit-breaker при API down
 * - FR-396: smoke-test invariant — все mutating вызовы только через legitimate source
 */
import type { MutationSource } from "./types.ts";

/**
 * Custom error types для разных категорий сбоев Metrika-агента.
 * См. contracts/metrika-management-api.md §«Error types».
 */
export class MetrikaError extends Error {
  override name = "MetrikaError";
}

export class MetrikaAuthError extends MetrikaError {
  override name = "MetrikaAuthError";
}

export class MetrikaRateLimitError extends MetrikaError {
  override name = "MetrikaRateLimitError";
}

export class MetrikaSafetyError extends MetrikaError {
  override name = "MetrikaSafetyError";
}

export class MetrikaCircuitBreakerError extends MetrikaError {
  override name = "MetrikaCircuitBreakerError";
}

export class MetrikaValidationError extends MetrikaError {
  override name = "MetrikaValidationError";
}

/**
 * Список critical-настроек counter, которые НЕ меняются без proposal (FR-392).
 * Если apply-config detect'ит, что эти поля меняются — требуется явный proposal.
 */
export const CRITICAL_COUNTER_SETTINGS = [
  "firstPartyCookies",
  "webvisor.enabled",
  "webvisor.formCapturing",
  "accurateTrackBounce",
  "trackLinks",
  "clickmap",
] as const;

/**
 * Source validation — обеспечивает FR-396 invariant на типовом уровне.
 *
 * Mutating-операции принимают `MutationSource` параметр; если он невалидный
 * (например, custom string vместо typed-object) — throw.
 */
export function validateMutationSource(source: unknown): asserts source is MutationSource {
  if (!source || typeof source !== "object") {
    throw new MetrikaSafetyError(
      "Mutating operation requires MutationSource (proposal/config_apply/manual_admin). " +
        "Direct mutations are not allowed (FR-384, FR-396).",
    );
  }
  const s = source as { kind?: string };
  if (s.kind === "proposal") {
    if (!(source as { proposalId?: string }).proposalId) {
      throw new MetrikaSafetyError("MutationSource kind='proposal' requires proposalId");
    }
  } else if (s.kind === "config_apply") {
    if (!(source as { runId?: string }).runId) {
      throw new MetrikaSafetyError("MutationSource kind='config_apply' requires runId");
    }
  } else if (s.kind === "manual_admin") {
    if (!(source as { adminUserId?: string }).adminUserId) {
      throw new MetrikaSafetyError("MutationSource kind='manual_admin' requires adminUserId");
    }
  } else {
    throw new MetrikaSafetyError(
      `MutationSource kind must be 'proposal' | 'config_apply' | 'manual_admin'. Got: ${s.kind ?? "undefined"}`,
    );
  }
}

/**
 * Hard-delete guard (FR-391).
 * Hard-delete возможен только если source.kind='proposal' И source.confirmationFlag === true.
 */
export function assertHardDeleteAllowed(source: MutationSource): asserts source is MutationSource & {
  confirmationFlag: true;
} {
  validateMutationSource(source);
  const s = source as MutationSource & { confirmationFlag?: boolean };
  if (s.kind !== "proposal" || s.confirmationFlag !== true) {
    throw new MetrikaSafetyError(
      "Hard delete requires confirmationFlag=true in approved proposal (FR-391). " +
        "Use soft-disable instead (enabled: false) to preserve history.",
    );
  }
}

/**
 * Простой in-memory rate limiter для FR-393.
 * Скользящее окно 60 секунд, max N calls.
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxPerMinute: number;

  constructor(maxPerMinute: number = 100) {
    this.maxPerMinute = maxPerMinute;
  }

  /**
   * Throws MetrikaRateLimitError if exceeded.
   * Возвращает delay-ms если нужно ждать (для backoff).
   */
  async checkAndRecord(): Promise<void> {
    const now = Date.now();
    const windowStart = now - 60_000;
    this.timestamps = this.timestamps.filter((t) => t >= windowStart);

    if (this.timestamps.length >= this.maxPerMinute) {
      const oldestInWindow = this.timestamps[0]!;
      const delayMs = oldestInWindow + 60_000 - now;
      throw new MetrikaRateLimitError(
        `Local rate limit hit (${this.maxPerMinute}/min). Wait ${Math.ceil(delayMs / 1000)}s.`,
      );
    }

    this.timestamps.push(now);
  }

  reset(): void {
    this.timestamps = [];
  }
}

/**
 * Circuit breaker для FR-395.
 * Открывается после N consecutive failures за окно; после cooldown — half-open.
 */
export class CircuitBreaker {
  private failures: number[] = [];
  private openedAt: number | null = null;
  private readonly threshold: number;
  private readonly windowMs: number;
  private readonly cooldownMs: number;

  constructor(
    threshold: number = 5,
    windowMs: number = 300_000, // 5 минут
    cooldownMs: number = 60_000, // 1 минута half-open
  ) {
    this.threshold = threshold;
    this.windowMs = windowMs;
    this.cooldownMs = cooldownMs;
  }

  recordFailure(): void {
    const now = Date.now();
    this.failures = this.failures.filter((t) => t >= now - this.windowMs);
    this.failures.push(now);

    if (this.failures.length >= this.threshold && !this.openedAt) {
      this.openedAt = now;
    }
  }

  recordSuccess(): void {
    if (this.openedAt) {
      // half-open success → close circuit
      this.openedAt = null;
      this.failures = [];
    }
  }

  /**
   * Throws if circuit is open.
   */
  check(): void {
    if (!this.openedAt) return;

    const now = Date.now();
    if (now - this.openedAt < this.cooldownMs) {
      throw new MetrikaCircuitBreakerError(
        `Circuit breaker open (${this.failures.length} failures in ${this.windowMs / 1000}s). ` +
          `Retry after ${Math.ceil((this.cooldownMs - (now - this.openedAt)) / 1000)}s.`,
      );
    }
    // cooldown elapsed → half-open (next call attempts)
  }

  reset(): void {
    this.failures = [];
    this.openedAt = null;
  }
}
