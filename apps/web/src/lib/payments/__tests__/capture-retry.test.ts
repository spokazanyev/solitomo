import { describe, expect, it } from "vitest";

import { computeNextRetryAt } from "../yookassa-webhook-handler";

describe("computeNextRetryAt (055 FR-5523a, R7)", () => {
  it("returns Date ~1min in future for 0 prior attempts", () => {
    const now = Date.now();
    const next = computeNextRetryAt(0);
    expect(next).not.toBeNull();
    expect(next!.getTime() - now).toBeGreaterThanOrEqual(60_000 - 1000);
    expect(next!.getTime() - now).toBeLessThan(60_000 + 1000);
  });

  it("follows backoff sequence: 1m → 5m → 15m → 1h → 6h → 24h", () => {
    const sequence = [
      [0, 1 * 60_000],
      [1, 5 * 60_000],
      [2, 15 * 60_000],
      [3, 60 * 60_000],
      [4, 6 * 60 * 60_000],
      [5, 24 * 60 * 60_000],
    ] as const;
    for (const [attempts, expectedDelay] of sequence) {
      const now = Date.now();
      const next = computeNextRetryAt(attempts);
      expect(next).not.toBeNull();
      const diff = next!.getTime() - now;
      // ±1s tolerance for test execution time
      expect(diff).toBeGreaterThanOrEqual(expectedDelay - 1000);
      expect(diff).toBeLessThan(expectedDelay + 1000);
    }
  });

  it("returns null after 6 attempts (exhausted, 7-day window)", () => {
    expect(computeNextRetryAt(6)).toBeNull();
    expect(computeNextRetryAt(10)).toBeNull();
    expect(computeNextRetryAt(100)).toBeNull();
  });
});
