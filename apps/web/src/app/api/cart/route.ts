/**
 * POST /api/cart — create a new cart (052 FR-5211, T013).
 *
 * Used when the client has no cookie or the existing cookie's cart is invalid.
 * Optional body: { items[], sourcePage, utm, customerEmail }.
 *
 * Returns 201 with cart state and sets HTTP-only cookie `soliton_cart_token`.
 * Rate-limited: 5/min, 30/day per IP (FR-5212a).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { cartError, getClientIp, hashIp, rateLimit } from "@/lib/cart/api-utils";
import { setCartTokenCookie } from "@/lib/cart/cookie";
import type { CartItem } from "@/lib/cart/merge";
import { createCart } from "@/lib/cart/repository";
import { generateCartToken } from "@/lib/cart/token";
// 057 US4: PDPA + offer consent validation + recording
import type { ConsentRecord } from "@/lib/consent/consent-types";
import {
  ConsentPolicyMissingError,
  makeConsentRecord,
} from "@/lib/consent/make-consent-record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateCartBody {
  items?: CartItem[];
  sourcePage?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  customerEmail?: string;
  marketingOptIn?: boolean;
  // 057 US4: explicit PDPA + offer consent (true required)
  consent?: boolean;
}

export async function POST(req: NextRequest) {
  // Rate limit (FR-5212a)
  const ip = getClientIp(req);
  if (!rateLimit(`cart:create:${ip}:1m`, 5, 60_000)) {
    return cartError(429, "rate_limited", "Too many requests");
  }
  if (!rateLimit(`cart:create:${ip}:1d`, 30, 24 * 60 * 60 * 1000)) {
    return cartError(429, "rate_limited", "Daily limit exceeded");
  }

  let body: CreateCartBody = {};
  try {
    const text = await req.text();
    if (text.trim().length > 0) body = JSON.parse(text);
  } catch {
    return cartError(400, "validation_failed", "Invalid JSON");
  }

  // 057 US4: PDPA + offer consent gate (FR-5712).
  if (body.consent !== true) {
    return NextResponse.json(
      { error: "CONSENT_REQUIRED", message: "Consent to PDPA and offer is required" },
      { status: 400 },
    );
  }
  let consentRecord: ConsentRecord;
  try {
    consentRecord = await makeConsentRecord(req);
  } catch (e) {
    if (e instanceof ConsentPolicyMissingError) {
      return NextResponse.json(
        {
          error: "POLICY_NOT_READY",
          message: "Policy documents are not yet published. Contact support.",
        },
        { status: 503 },
      );
    }
    throw e;
  }

  // Validate items (if provided)
  if (body.items && !Array.isArray(body.items)) {
    return cartError(400, "validation_failed", "items must be an array");
  }
  if (body.items && body.items.length > 100) {
    return cartError(400, "validation_failed", "Maximum 100 items per cart");
  }

  // Normalize items
  const items: CartItem[] = (body.items ?? []).map((raw) => ({
    sku: String(raw.sku ?? "").slice(0, 120),
    name: String(raw.name ?? "").slice(0, 240),
    qty: Math.min(9999, Math.max(1, Math.floor(Number(raw.qty) || 1))),
    priceAtAdd:
      typeof raw.priceAtAdd === "number" && Number.isFinite(raw.priceAtAdd) ? raw.priceAtAdd : null,
    addedAt: new Date().toISOString(),
    productId: raw.productId,
    slug: raw.slug,
    image: raw.image,
    warning: "none",
  }));

  // Validate + normalize email if provided (M9, L1)
  let customerEmail: string | undefined;
  if (body.customerEmail) {
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customerEmail) ||
      body.customerEmail.length > 254
    ) {
      return cartError(400, "validation_failed", "Invalid customerEmail");
    }
    customerEmail = body.customerEmail.trim().toLowerCase();
  }

  const cartToken = generateCartToken();
  const userAgent = req.headers.get("user-agent") ?? undefined;

  try {
    const payload = await getPayload({ config: configPromise });
    const cart = await createCart(payload, {
      cartToken,
      items,
      sourcePage: body.sourcePage,
      utm: body.utm,
      customerEmail,
      marketingOptIn: body.marketingOptIn ?? false,
      ipHash: hashIp(ip),
      userAgent,
      // 057 US4: persist PDPA + offer consent record (152-ФЗ Art. 9)
      consent: consentRecord,
    });

    await setCartTokenCookie(cartToken);

    return NextResponse.json(cart, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[cart] POST /api/cart failed:", err);
    return cartError(500, "validation_failed", "Failed to create cart");
  }
}
