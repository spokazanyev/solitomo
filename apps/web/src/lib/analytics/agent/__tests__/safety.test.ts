/**
 * Tests for safety invariants (FR-391/392/393/395/396).
 */
import { describe, expect, it, vi } from "vitest";

import {
  assertHardDeleteAllowed,
  CircuitBreaker,
  MetrikaCircuitBreakerError,
  MetrikaRateLimitError,
  MetrikaSafetyError,
  RateLimiter,
  validateMutationSource,
} from "../safety.ts";
import type { MutationSource } from "../types.ts";

describe("validateMutationSource (FR-384, FR-396)", () => {
  it("accepts proposal-source with proposalId", () => {
    expect(() => validateMutationSource({ kind: "proposal", proposalId: "p-123" })).not.toThrow();
  });

  it("accepts config_apply-source with runId", () => {
    expect(() => validateMutationSource({ kind: "config_apply", runId: "run-1" })).not.toThrow();
  });

  it("accepts manual_admin-source with adminUserId", () => {
    expect(() => validateMutationSource({ kind: "manual_admin", adminUserId: "u-1" })).not.toThrow();
  });

  it("rejects undefined/null/string", () => {
    expect(() => validateMutationSource(undefined)).toThrow(MetrikaSafetyError);
    expect(() => validateMutationSource(null)).toThrow(MetrikaSafetyError);
    expect(() => validateMutationSource("not-an-object")).toThrow(MetrikaSafetyError);
  });

  it("rejects proposal kind without proposalId", () => {
    expect(() => validateMutationSource({ kind: "proposal" })).toThrow(/proposalId/);
  });

  it("rejects config_apply kind without runId", () => {
    expect(() => validateMutationSource({ kind: "config_apply" })).toThrow(/runId/);
  });

  it("rejects unknown kind", () => {
    expect(() => validateMutationSource({ kind: "rogue" })).toThrow(/kind must be/);
  });
});

describe("assertHardDeleteAllowed (FR-391)", () => {
  it("allows when proposal + confirmationFlag=true", () => {
    const source = { kind: "proposal" as const, proposalId: "p-1", confirmationFlag: true };
    expect(() => assertHardDeleteAllowed(source as MutationSource)).not.toThrow();
  });

  it("rejects config_apply source (даже c proposalId)", () => {
    const source = { kind: "config_apply" as const, runId: "r-1" };
    expect(() => assertHardDeleteAllowed(source as MutationSource)).toThrow(/confirmationFlag/);
  });

  it("rejects proposal без confirmationFlag", () => {
    const source = { kind: "proposal" as const, proposalId: "p-1" };
    expect(() => assertHardDeleteAllowed(source as MutationSource)).toThrow(/confirmationFlag/);
  });

  it("rejects proposal с confirmationFlag=false", () => {
    const source = { kind: "proposal" as const, proposalId: "p-1", confirmationFlag: false };
    expect(() => assertHardDeleteAllowed(source as unknown as MutationSource)).toThrow(/confirmationFlag/);
  });
});

describe("RateLimiter (FR-393)", () => {
  it("allows up to maxPerMinute calls", async () => {
    const limiter = new RateLimiter(3);
    await limiter.checkAndRecord();
    await limiter.checkAndRecord();
    await limiter.checkAndRecord();
    // 4-й должен throw
    await expect(limiter.checkAndRecord()).rejects.toBeInstanceOf(MetrikaRateLimitError);
  });

  it("resets window after 60 seconds", async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(2);
    await limiter.checkAndRecord();
    await limiter.checkAndRecord();
    await expect(limiter.checkAndRecord()).rejects.toBeInstanceOf(MetrikaRateLimitError);

    // Сдвигаем время на 61 секунду
    vi.advanceTimersByTime(61_000);
    await expect(limiter.checkAndRecord()).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it("reset() clears timestamps", async () => {
    const limiter = new RateLimiter(1);
    await limiter.checkAndRecord();
    limiter.reset();
    await expect(limiter.checkAndRecord()).resolves.toBeUndefined();
  });
});

describe("CircuitBreaker (FR-395)", () => {
  it("does not open before threshold", () => {
    const cb = new CircuitBreaker(3);
    cb.recordFailure();
    cb.recordFailure();
    expect(() => cb.check()).not.toThrow();
  });

  it("opens at threshold and throws on check()", () => {
    const cb = new CircuitBreaker(3, 60_000, 60_000);
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(() => cb.check()).toThrow(MetrikaCircuitBreakerError);
  });

  it("recovers after cooldown", () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker(2, 60_000, 30_000);
    cb.recordFailure();
    cb.recordFailure();
    expect(() => cb.check()).toThrow(MetrikaCircuitBreakerError);

    vi.advanceTimersByTime(31_000);
    expect(() => cb.check()).not.toThrow();
    vi.useRealTimers();
  });

  it("recordSuccess() closes circuit", () => {
    const cb = new CircuitBreaker(2);
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    expect(() => cb.check()).not.toThrow();
  });

  it("failure outside window не учитывается", () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker(2, 60_000, 60_000);
    cb.recordFailure();

    // 70 секунд прошло — старая failure пропадает из окна
    vi.advanceTimersByTime(70_000);

    cb.recordFailure();
    // Теперь только 1 failure в окне (вторая) — circuit не открыт
    expect(() => cb.check()).not.toThrow();
    vi.useRealTimers();
  });
});
