/**
 * 062 T044: Unit-тесты server-side handoverNote validation в POST /api/orders.
 *
 * Покрытие FR-062-14 (own_carrier) и FR-062-19 (pickup):
 *  - own_carrier без note → 400 MISSING_HANDOVER_NOTE
 *  - own_carrier с note < 10 chars → 400 HANDOVER_NOTE_TOO_SHORT
 *  - pickup с note < 5 chars → 400 HANDOVER_NOTE_TOO_SHORT
 *  - Валидный own_carrier (note ≥ 10) → 201 (без ошибок валидации)
 *
 * Все side-effect-зависимости (Payload, cart repo, consent, session) замоканы
 * через vi.mock — тест фокусируется ТОЛЬКО на guard'ах валидации в начале
 * route.ts, до создания заказа.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// @payload-config: уже подменён через vitest.config.ts alias на shim.

// payload runtime: возвращаем fake getPayload, который НЕ должен быть вызван
// для 400-кейсов (т.к. валидация падает раньше). Для 201-кейса возвращаем
// stub create + найдённую корзину.
const mockCartRecord = {
  id: 42,
  status: "active",
  convertedToOrderId: null,
};
const mockOrderRecord = {
  id: 123,
  publicToken: "tok_abc",
  status: "awaiting_payment",
  type: "legal",
};
const mockPayload = {
  create: vi.fn().mockResolvedValue(mockOrderRecord),
  logger: { error: vi.fn(), info: vi.fn() },
};

vi.mock("payload", () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}));

vi.mock("@/lib/cart/cookie", () => ({
  getCartTokenFromCookie: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/cart/repository", () => ({
  CartAlreadyConvertedError: class CartAlreadyConvertedError extends Error {
    existingOrderId: string;
    constructor(existingOrderId: string) {
      super("already converted");
      this.existingOrderId = existingOrderId;
    }
  },
  createCart: vi.fn().mockResolvedValue(mockCartRecord),
  findByToken: vi.fn().mockResolvedValue(null),
  markConverted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/cart/token", () => ({
  generateCartToken: vi.fn(() => "tok_test_cart"),
}));

vi.mock("@/lib/consent/make-consent-record", () => ({
  ConsentPolicyMissingError: class ConsentPolicyMissingError extends Error {},
  makeConsentRecord: vi.fn().mockResolvedValue({
    given: true,
    timestamp: "2026-05-27T00:00:00.000Z",
    ipHash: "deadbeef",
    userAgent: "vitest",
    offerVersion: "v1",
    pdPolicyVersion: "v1",
  }),
}));

vi.mock("@/lib/customers/session", () => ({
  loadCustomerFromRequest: vi.fn().mockResolvedValue(null),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Сборка валидного "минимального" body, в который тест подмешивает delivery. */
function makeBody(overrides: Record<string, unknown> = {}) {
  return {
    type: "legal",
    consent: true,
    items: [
      {
        sku: "S-4",
        name: "Блок розеток 19″ 1U",
        quantity: 1,
        price: 4800,
      },
    ],
    customer: {
      fullName: "Иванов Иван",
      email: "ivan@example.com",
      phone: "+79991234567",
      companyName: "ООО Тест",
      inn: "7707083893",
    },
    sourcePage: "/cart/invoice/",
    ...overrides,
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("https://example.com/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Импорт ПОСЛЕ vi.mock, чтобы моки точно встали (vitest hoist'ит vi.mock).
async function importPOST() {
  const mod = await import("../route");
  return mod.POST;
}

beforeEach(() => {
  mockPayload.create.mockClear();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/orders — handoverNote validation (062 T014)", () => {
  it("own_carrier без handoverNote → 400 MISSING_HANDOVER_NOTE", async () => {
    const POST = await importPOST();
    const res = await POST(
      makeRequest(
        makeBody({
          delivery: { method: "own_carrier", cost: 0 },
        }),
      ),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("MISSING_HANDOVER_NOTE");
    // create() не вызывался — валидация падает раньше Payload-side-effect.
    expect(mockPayload.create).not.toHaveBeenCalled();
  });

  it("own_carrier с 5-символьной заметкой → 400 HANDOVER_NOTE_TOO_SHORT", async () => {
    const POST = await importPOST();
    const res = await POST(
      makeRequest(
        makeBody({
          delivery: { method: "own_carrier", cost: 0, handoverNote: "short" },
        }),
      ),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("HANDOVER_NOTE_TOO_SHORT");
    expect(mockPayload.create).not.toHaveBeenCalled();
  });

  it("pickup с 4-символьной заметкой → 400 HANDOVER_NOTE_TOO_SHORT", async () => {
    const POST = await importPOST();
    const res = await POST(
      makeRequest(
        makeBody({
          delivery: { method: "pickup", cost: 0, handoverNote: "test" },
        }),
      ),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("HANDOVER_NOTE_TOO_SHORT");
    expect(mockPayload.create).not.toHaveBeenCalled();
  });

  it("pickup без handoverNote → 400 MISSING_HANDOVER_NOTE", async () => {
    const POST = await importPOST();
    const res = await POST(
      makeRequest(
        makeBody({
          delivery: { method: "pickup", cost: 0 },
        }),
      ),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("MISSING_HANDOVER_NOTE");
    expect(mockPayload.create).not.toHaveBeenCalled();
  });

  it("own_carrier с валидной 30-символьной заметкой → 201", async () => {
    const POST = await importPOST();
    const validNote = "ПЭК, договор 4567, +79991234567"; // 31 chars
    const res = await POST(
      makeRequest(
        makeBody({
          delivery: { method: "own_carrier", cost: 0, handoverNote: validNote },
        }),
      ),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as { id?: unknown; status?: string };
    expect(json.id).toBe(123);
    // payload.create вызывался — guard'ы валидации не отрицали запрос.
    expect(mockPayload.create).toHaveBeenCalledTimes(1);
    const createArg = mockPayload.create.mock.calls[0]?.[0] as {
      data?: { delivery?: { method?: string; handoverNote?: string; cost?: number } };
    };
    expect(createArg.data?.delivery?.method).toBe("own_carrier");
    expect(createArg.data?.delivery?.handoverNote).toBe(validNote);
    // FR-062-15: own_carrier → cost=0
    expect(createArg.data?.delivery?.cost).toBe(0);
  });

  it("handoverNote > 1000 chars → 400 HANDOVER_NOTE_TOO_LONG (FR-062-21)", async () => {
    const POST = await importPOST();
    const tooLong = "a".repeat(1001);
    const res = await POST(
      makeRequest(
        makeBody({
          delivery: { method: "own_carrier", cost: 0, handoverNote: tooLong },
        }),
      ),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("HANDOVER_NOTE_TOO_LONG");
    expect(mockPayload.create).not.toHaveBeenCalled();
  });
});
