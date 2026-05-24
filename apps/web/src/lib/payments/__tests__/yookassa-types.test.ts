import { describe, expect, it } from "vitest";

import { composeEventId, tryParseWebhookEvent } from "../yookassa-types";

describe("composeEventId (055 FR-5531, R3)", () => {
  it("composes id from object.id + event type", () => {
    const id = composeEventId({
      type: "notification",
      event: "payment.succeeded",
      object: { id: "abc-123" } as never,
    });
    expect(id).toBe("abc-123:payment.succeeded");
  });

  it("produces different ids for same payment but different event types", () => {
    const obj = { id: "abc-123" } as never;
    const a = composeEventId({ type: "notification", event: "payment.waiting_for_capture", object: obj });
    const b = composeEventId({ type: "notification", event: "payment.succeeded", object: obj });
    expect(a).not.toBe(b);
  });
});

describe("tryParseWebhookEvent", () => {
  it("returns event for valid notification body", () => {
    const event = tryParseWebhookEvent({
      type: "notification",
      event: "payment.succeeded",
      object: { id: "p_1", status: "succeeded", amount: { value: "100.00", currency: "RUB" }, created_at: new Date().toISOString() },
    });
    expect(event).not.toBeNull();
    expect(event?.event).toBe("payment.succeeded");
  });

  it("returns null for missing object.id", () => {
    expect(tryParseWebhookEvent({ type: "notification", event: "payment.succeeded", object: {} })).toBeNull();
  });

  it("returns null for unknown event type", () => {
    expect(
      tryParseWebhookEvent({ type: "notification", event: "unknown.event", object: { id: "x" } }),
    ).toBeNull();
  });

  it("returns null for non-notification type", () => {
    expect(
      tryParseWebhookEvent({ type: "other", event: "payment.succeeded", object: { id: "x" } }),
    ).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(tryParseWebhookEvent(null)).toBeNull();
    expect(tryParseWebhookEvent("not an object")).toBeNull();
    expect(tryParseWebhookEvent(undefined)).toBeNull();
  });
});
