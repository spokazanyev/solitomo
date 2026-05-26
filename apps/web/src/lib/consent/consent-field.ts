import type { Field } from "payload";
import { adminLabel } from "../../collections/admin-i18n.js";

/**
 * Возвращает Payload field definition для группы `consent`.
 * Подключается в Orders.js / Carts.ts / Customers.ts / RfqRequests.ts.
 */
export function consentField(): Field {
  return {
    name: "consent",
    type: "group",
    label: adminLabel("Согласие на обработку ПДн", "Consent (PDPA)"),
    admin: {
      readOnly: true,
      description: adminLabel(
        "Заполняется автоматически при создании. Фиксация в соответствии с 152-ФЗ ст. 9.",
        "Auto-filled on creation. Compliance with Federal Law 152-FZ Art. 9.",
      ),
    },
    fields: [
      {
        name: "consentedAt",
        type: "date",
        admin: { readOnly: true },
      },
      {
        name: "policyVersionPrivacy",
        type: "text",
        admin: { readOnly: true },
      },
      {
        name: "policyVersionOffer",
        type: "text",
        admin: { readOnly: true },
      },
      {
        name: "ipHash",
        type: "text",
        admin: { readOnly: true },
      },
      {
        name: "userAgent",
        type: "text",
        maxLength: 200,
        admin: { readOnly: true },
      },
    ],
  };
}
