import config from "@payload-config";
import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";

// 057 US4: PDPA + offer consent validation + recording
import type { ConsentRecord } from "@/lib/consent/consent-types";
import {
  ConsentPolicyMissingError,
  makeConsentRecord,
} from "@/lib/consent/make-consent-record";

type RfqItem = {
  name?: string;
  quantity?: string;
  sku?: string;
};

type RfqPayload = {
  city?: string;
  companyName?: string;
  contactName?: string;
  customerType?: string;
  deadline?: string;
  email?: string;
  inn?: string;
  items?: RfqItem[];
  message?: string;
  phone?: string;
  sourcePage?: string;
  technicalSpec?: string;
  // 057 US4: explicit PDPA + offer consent (true required)
  consent?: boolean;
};

const MAX_TEXT_LENGTH = 3000;
const customerTypes = ["company", "person", "integrator"] as const;

type CustomerType = (typeof customerTypes)[number];

export const runtime = "nodejs";

function cleanText(value: unknown, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function cleanItems(items: unknown): RfqItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      sku: cleanText(item?.sku, 120),
      name: cleanText(item?.name, 240),
      quantity: cleanText(item?.quantity, 40),
    }))
    .filter((item) => item.sku || item.name || item.quantity)
    .slice(0, 20);
}

function cleanCustomerType(value: unknown): CustomerType {
  return customerTypes.includes(value as CustomerType)
    ? (value as CustomerType)
    : "company";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RfqPayload;

    // 057 US4: PDPA + offer consent gate (FR-5712). Must precede side-effects.
    if (body.consent !== true) {
      return NextResponse.json(
        { error: "CONSENT_REQUIRED", message: "Consent to PDPA and offer is required" },
        { status: 400 },
      );
    }
    let consentRecord: ConsentRecord;
    try {
      consentRecord = await makeConsentRecord(request);
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

    const contactName = cleanText(body.contactName, 160);
    const email = cleanText(body.email, 160);
    const phone = cleanText(body.phone, 80);
    const items = cleanItems(body.items);

    if (!contactName) {
      return NextResponse.json(
        { error: "Укажите контактное лицо." },
        { status: 400 },
      );
    }

    if (!email && !phone) {
      return NextResponse.json(
        { error: "Укажите email или телефон для связи." },
        { status: 400 },
      );
    }

    const requestData = {
      status: "new" as const,
      sourcePage: cleanText(body.sourcePage, 240),
      customerType: cleanCustomerType(body.customerType),
      companyName: cleanText(body.companyName, 180),
      inn: cleanText(body.inn, 40),
      contactName,
      email,
      phone,
      city: cleanText(body.city, 120),
      deadline: cleanText(body.deadline, 120),
      items: JSON.stringify(items, null, 2),
      requestedItems: items,
      message: cleanText(body.message),
      technicalSpec: cleanText(body.technicalSpec),
      analytics: JSON.stringify(
        {
          createdFrom: "site-rfq-form",
          userAgent: request.headers.get("user-agent") ?? "",
        },
        null,
        2,
      ),
    };

    try {
      const payload = await getPayload({ config });
      const created = await payload.create({
        collection: "rfq-requests",
        // 057 US4: persist PDPA + offer consent record (152-ФЗ Art. 9)
        data: { ...requestData, consent: consentRecord },
      });

      return NextResponse.json({
        id: created.id,
        ok: true,
        storage: "payload",
      });
    } catch (error) {
      console.error("RFQ Payload save failed, writing local fallback", error);
      const id = `local-${Date.now()}`;
      const fallbackDir = path.join(
        process.cwd(),
        "..",
        "..",
        "00-source-data",
        "rfq-submissions",
      );
      await fs.mkdir(fallbackDir, { recursive: true });
      await fs.appendFile(
        path.join(fallbackDir, "rfq-requests.jsonl"),
        `${JSON.stringify({
          id,
          createdAt: new Date().toISOString(),
          ...requestData,
        })}\n`,
        "utf8",
      );

      return NextResponse.json({
        fallback: true,
        id,
        ok: true,
        storage: "local-jsonl",
      });
    }
  } catch (error) {
    console.error("RFQ submit failed", error);
    return NextResponse.json(
      { error: "Не удалось сохранить заявку. Попробуйте еще раз." },
      { status: 500 },
    );
  }
}
