/**
 * Normalizes a DaData `suggest/party` record into flat company requisites
 * consumed by `InvoiceCheckoutForm` (data-model.md §2 / R5).
 *
 * Pure, client-safe module: no `server-only` import, no network access.
 * All string fields default to `""` (never `undefined`) so the result can be
 * assigned directly to controlled-input `value`s (FR-006).
 */

import type { DadataPartyData } from "./client";

export interface CompanyRequisites {
  companyName: string;
  inn: string;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  status: "ACTIVE" | "LIQUIDATING" | "LIQUIDATED" | "BANKRUPT" | "REORGANIZING" | null;
  isRisky: boolean;
}

export function partyToRequisites(data: DadataPartyData): CompanyRequisites {
  const status = data.state?.status ?? null;
  const isRisky =
    status === "LIQUIDATING" || status === "LIQUIDATED" || status === "BANKRUPT";

  return {
    companyName: data.name?.short_with_opf ?? data.name?.full_with_opf ?? "",
    inn: data.inn ?? "",
    kpp: data.kpp ?? "",
    ogrn: data.ogrn ?? "",
    legalAddress: data.address?.unrestricted_value ?? data.address?.value ?? "",
    status,
    isRisky,
  };
}
