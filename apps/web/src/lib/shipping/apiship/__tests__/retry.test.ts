import { describe, it, expect, vi } from "vitest";

import { executeWithRetry } from "../retry";

describe("executeWithRetry", () => {
  it("succeeds on the first attempt when isReady is true", async () => {
    const apiCall = vi.fn().mockResolvedValue({ ok: true });
    const result = await executeWithRetry({
      apiCall,
      isReady: (res) => Boolean((res as { ok?: boolean }).ok),
      maxAttempts: 5,
      baseDelay: 1,
    });
    expect(result).toEqual({ ok: true });
    expect(apiCall).toHaveBeenCalledTimes(1);
  });

  it("retries while isReady() is false, then resolves", async () => {
    const apiCall = vi
      .fn()
      .mockResolvedValueOnce({ ready: false })
      .mockResolvedValueOnce({ ready: false })
      .mockResolvedValueOnce({ ready: true, value: 42 });

    const result = await executeWithRetry({
      apiCall,
      isReady: (res) => Boolean((res as { ready?: boolean }).ready),
      maxAttempts: 5,
      baseDelay: 1,
    });

    expect(result).toEqual({ ready: true, value: 42 });
    expect(apiCall).toHaveBeenCalledTimes(3);
  });

  it("throws after maxAttempts attempts with not-ready responses", async () => {
    const apiCall = vi.fn().mockResolvedValue({ ready: false });
    await expect(
      executeWithRetry({
        apiCall,
        isReady: () => false,
        maxAttempts: 3,
        baseDelay: 1,
        label: "test-call",
      }),
    ).rejects.toThrow(/test-call: data not ready after 3 attempts/);
    expect(apiCall).toHaveBeenCalledTimes(3);
  });

  it("retries when apiCall throws and surfaces last error in message", async () => {
    const apiCall = vi
      .fn()
      .mockRejectedValueOnce(new Error("network blip"))
      .mockRejectedValueOnce(new Error("still failing"));

    await expect(
      executeWithRetry({
        apiCall,
        isReady: () => true,
        maxAttempts: 2,
        baseDelay: 1,
        label: "boom",
      }),
    ).rejects.toThrow(/boom: data not ready after 2 attempts.*still failing/);
    expect(apiCall).toHaveBeenCalledTimes(2);
  });
});
