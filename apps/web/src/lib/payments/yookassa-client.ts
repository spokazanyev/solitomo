import "server-only";

/**
 * ЮKassa REST API client (055 T012, FR-5501..5511, FR-5520..5523).
 *
 * Coverage:
 *   - POST /v3/payments       — createPayment
 *   - POST /v3/payments/{id}/capture — capturePayment
 *   - POST /v3/payments/{id}/cancel  — cancelPayment
 *   - GET  /v3/payments/{id}  — getPayment
 *   - POST /v3/refunds (already in yookassa-refunds.ts)
 *
 * Auth: Basic, Idempotence-Key (spelled per ЮKassa convention, FR-5591).
 * Timeout: 10s.
 * Retry: caller responsibility (cron does exp-backoff; create endpoint
 *        does up to 3 retries with same key per FR-5511).
 */

import { loadYooKassaCredentials } from "./settings";
import type {
  CapturePaymentRequest,
  CreatePaymentRequest,
  YooKassaPaymentObject,
} from "./yookassa-types";

const BASE_URL = "https://api.yookassa.ru/v3";
const TIMEOUT_MS = 10_000;

export class YooKassaClientError extends Error {
  readonly status: number;
  readonly body: string;
  readonly providerCode?: string;

  constructor(message: string, status: number, body: string, providerCode?: string) {
    super(message);
    this.name = "YooKassaClientError";
    this.status = status;
    this.body = body;
    this.providerCode = providerCode;
  }
}

export class YooKassaNetworkError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "YooKassaNetworkError";
    this.cause = cause;
  }
}

/** Stub-индикатор для dev-mode (когда creds отсутствуют). */
export interface StubResponse<T> {
  data: T;
  stub: true;
}

export interface RealResponse<T> {
  data: T;
  stub: false;
}

export type YooKassaResponse<T> = RealResponse<T> | StubResponse<T>;

export interface ClientCallOptions {
  idempotencyKey: string;
  /** Override timeout (для tests / специальных cases). */
  timeoutMs?: number;
}

/**
 * POST /v3/payments — создаёт платёж (FR-5501..5508).
 */
export async function createPayment(
  body: CreatePaymentRequest,
  opts: ClientCallOptions,
): Promise<YooKassaResponse<YooKassaPaymentObject>> {
  return doPost<CreatePaymentRequest, YooKassaPaymentObject>(`/payments`, body, opts);
}

/**
 * POST /v3/payments/{id}/capture — capture для two-stage платежей (FR-5521).
 */
export async function capturePayment(
  paymentId: string,
  body: CapturePaymentRequest,
  opts: ClientCallOptions,
): Promise<YooKassaResponse<YooKassaPaymentObject>> {
  return doPost<CapturePaymentRequest, YooKassaPaymentObject>(
    `/payments/${encodeURIComponent(paymentId)}/capture`,
    body,
    opts,
  );
}

/**
 * POST /v3/payments/{id}/cancel — отмена авторизации (FR-5523).
 */
export async function cancelPayment(
  paymentId: string,
  opts: ClientCallOptions,
): Promise<YooKassaResponse<YooKassaPaymentObject>> {
  return doPost<Record<string, never>, YooKassaPaymentObject>(
    `/payments/${encodeURIComponent(paymentId)}/cancel`,
    {},
    opts,
  );
}

/**
 * GET /v3/payments/{id} — read-only state lookup для cron-reconciliation (FR-5581).
 */
export async function getPayment(
  paymentId: string,
): Promise<YooKassaResponse<YooKassaPaymentObject>> {
  const creds = loadYooKassaCredentials();
  if (!creds) return makeStubGet(paymentId);

  const auth = Buffer.from(`${creds.shopId}:${creds.secretKey}`).toString("base64");
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/payments/${encodeURIComponent(paymentId)}`, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new YooKassaNetworkError(`getPayment(${maskId(paymentId)}) network error`, err);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new YooKassaClientError(
      `getPayment(${maskId(paymentId)}) status=${response.status}`,
      response.status,
      text.slice(0, 500),
    );
  }
  const data = (await response.json()) as YooKassaPaymentObject;
  return { data, stub: false };
}

// --- internal -----------------------------------------------------------------

async function doPost<TBody, TResult>(
  path: string,
  body: TBody,
  opts: ClientCallOptions,
): Promise<YooKassaResponse<TResult>> {
  if (!opts.idempotencyKey || opts.idempotencyKey.length < 8) {
    throw new Error(`yookassa-client: idempotencyKey is required (≥8 chars), got: ${opts.idempotencyKey?.slice(0, 4) ?? "<empty>"}`);
  }
  const creds = loadYooKassaCredentials();
  if (!creds) return makeStubPost<TBody, TResult>(path, body, opts);

  const auth = Buffer.from(`${creds.shopId}:${creds.secretKey}`).toString("base64");
  const timeout = opts.timeoutMs ?? TIMEOUT_MS;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        // ЮKassa spelling: Idempotence-Key (без `y` — FR-5591)
        "Idempotence-Key": opts.idempotencyKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (err) {
    throw new YooKassaNetworkError(`POST ${path} network error`, err);
  }

  const text = await response.text().catch(() => "");
  if (!response.ok) {
    let providerCode: string | undefined;
    try {
      const parsed = JSON.parse(text) as { code?: string };
      providerCode = parsed.code;
    } catch {
      // ignore parse error
    }
    throw new YooKassaClientError(
      `POST ${path} status=${response.status}${providerCode ? ` code=${providerCode}` : ""}`,
      response.status,
      text.slice(0, 500),
      providerCode,
    );
  }

  let data: TResult;
  try {
    data = JSON.parse(text) as TResult;
  } catch (err) {
    throw new YooKassaClientError(`POST ${path} invalid JSON response`, 500, text.slice(0, 500));
  }
  return { data, stub: false };
}

// --- stub helpers (dev-mode without real creds) ------------------------------

function makeStubPost<TBody, TResult>(
  path: string,
  body: TBody,
  opts: ClientCallOptions,
): YooKassaResponse<TResult> {
  // eslint-disable-next-line no-console
  console.warn(
    `[yookassa-client] DEV stub — no creds, returning fake for ${path} (idempotency=${opts.idempotencyKey.slice(0, 8)}...)`,
  );
  if (path === "/payments") {
    const stubId = `stub_${opts.idempotencyKey}`;
    const reqBody = body as unknown as CreatePaymentRequest;
    return {
      data: {
        id: stubId,
        status: reqBody.capture ? "succeeded" : "pending",
        amount: reqBody.amount,
        created_at: new Date().toISOString(),
        paid: reqBody.capture === true,
        test: true,
        confirmation: { type: "redirect", confirmation_url: `https://stub.yookassa.local/${stubId}` },
      } as unknown as TResult,
      stub: true,
    };
  }
  if (path.endsWith("/capture")) {
    const paymentId = path.split("/")[2] ?? "stub";
    return {
      data: {
        id: paymentId,
        status: "succeeded",
        amount: { value: "0.00", currency: "RUB" },
        created_at: new Date().toISOString(),
        captured_at: new Date().toISOString(),
        paid: true,
        test: true,
      } as unknown as TResult,
      stub: true,
    };
  }
  if (path.endsWith("/cancel")) {
    const paymentId = path.split("/")[2] ?? "stub";
    return {
      data: {
        id: paymentId,
        status: "canceled",
        amount: { value: "0.00", currency: "RUB" },
        created_at: new Date().toISOString(),
        paid: false,
        test: true,
      } as unknown as TResult,
      stub: true,
    };
  }
  // Unknown path — return empty stub
  return { data: {} as TResult, stub: true };
}

function makeStubGet(paymentId: string): YooKassaResponse<YooKassaPaymentObject> {
  return {
    data: {
      id: paymentId,
      status: "pending",
      amount: { value: "0.00", currency: "RUB" },
      created_at: new Date().toISOString(),
      paid: false,
      test: true,
    },
    stub: true,
  };
}

function maskId(id: string): string {
  if (id.length <= 8) return "***";
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}
