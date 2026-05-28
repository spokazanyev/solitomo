import "server-only";

import axios, { AxiosInstance } from "axios";

import { loadSettings } from "../shipping/apiship/settings";

export interface DadataSuggestion {
  value: string;
  unrestricted_value?: string;
  data?: Record<string, unknown>;
}

export interface DadataAddress {
  value: string;
  unrestricted_value?: string;
  postal_code?: string;
  region?: string;
  city?: string;
  street?: string;
  house?: string;
  flat?: string;
  geo_lat?: string;
  geo_lon?: string;
  kladr_id?: string;
  fias_id?: string;
  qc?: string;
  unparsed_parts?: string;
}

const SUGGEST_URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address";
const CLEAN_URL = "https://cleaner.dadata.ru/api/v1/clean/address";
// 057+: extra suggest endpoints for the checkout contact-block fields.
// FIO + email use the same free `suggest` tier (no X-Secret needed).
const SUGGEST_FIO_URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/fio";
const SUGGEST_EMAIL_URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/email";
const SUGGEST_PARTY_URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party";

async function getClient(useSecret: boolean): Promise<{ http: AxiosInstance; configured: boolean }> {
  const settings = await loadSettings();
  const apiKey = settings.dadata.apiKey || process.env.DADATA_API_KEY || "";
  const secret = settings.dadata.secret || process.env.DADATA_SECRET || "";
  if (!apiKey) return { http: axios.create(), configured: false };
  if (useSecret && !secret) return { http: axios.create(), configured: false };

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Token ${apiKey}`,
  };
  if (useSecret) headers["X-Secret"] = secret;

  return {
    http: axios.create({ headers, timeout: 5000 }),
    configured: true,
  };
}

export async function suggestAddress(query: string, count = 7): Promise<DadataSuggestion[]> {
  if (!query || query.trim().length < 2) return [];
  const { http, configured } = await getClient(false);
  if (!configured) return [];
  try {
    const { data } = await http.post<{ suggestions: DadataSuggestion[] }>(SUGGEST_URL, {
      query,
      count,
    });
    return data.suggestions ?? [];
  } catch {
    return [];
  }
}

export async function cleanAddress(address: string): Promise<DadataAddress | null> {
  if (!address) return null;
  const { http, configured } = await getClient(true);
  if (!configured) return null;
  try {
    const { data } = await http.post<DadataAddress[]>(CLEAN_URL, [address]);
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

export interface NormalizedAddress {
  raw: string;
  postalCode?: string;
  region?: string;
  city?: string;
  street?: string;
  house?: string;
  flat?: string;
  lat?: number;
  lon?: number;
  kladrId?: string;
  fiasId?: string;
  isValid: boolean;
  qualityCode?: string;
  unparsedParts?: string[];
}

// ─── FIO suggestions (free tier) ────────────────────────────────────

export interface DadataFioData {
  surname?: string;
  name?: string;
  patronymic?: string;
  gender?: "MALE" | "FEMALE" | "UNKNOWN";
  source?: string;
  qc?: string;
}

export interface DadataFioSuggestion {
  value: string;
  unrestricted_value?: string;
  data: DadataFioData;
}

/** Suggest full names. `parts` narrows the suggestion type, e.g. ["NAME"] for first names only. */
export async function suggestFio(
  query: string,
  count = 7,
  parts?: Array<"NAME" | "PATRONYMIC" | "SURNAME">,
): Promise<DadataFioSuggestion[]> {
  if (!query || query.trim().length < 1) return [];
  const { http, configured } = await getClient(false);
  if (!configured) return [];
  try {
    const { data } = await http.post<{ suggestions: DadataFioSuggestion[] }>(SUGGEST_FIO_URL, {
      query,
      count,
      ...(parts ? { parts } : {}),
    });
    return data.suggestions ?? [];
  } catch {
    return [];
  }
}

// ─── Email suggestions (free tier) ──────────────────────────────────

export interface DadataEmailData {
  local?: string;
  domain?: string;
  type?: string;
  source?: string;
  qc?: string;
}

export interface DadataEmailSuggestion {
  value: string;
  unrestricted_value?: string;
  data: DadataEmailData;
}

/**
 * Suggest email addresses. DaData both autocompletes the local part with
 * common domains (gmail.com, mail.ru, yandex.ru, ...) when the user types
 * `local@` and corrects typos like `gmial.com` → `gmail.com` once the full
 * address is typed.
 */
export async function suggestEmail(
  query: string,
  count = 5,
): Promise<DadataEmailSuggestion[]> {
  if (!query || query.trim().length < 1) return [];
  const { http, configured } = await getClient(false);
  if (!configured) return [];
  try {
    const { data } = await http.post<{ suggestions: DadataEmailSuggestion[] }>(
      SUGGEST_EMAIL_URL,
      { query, count },
    );
    return data.suggestions ?? [];
  } catch {
    return [];
  }
}

// ─── Party (organization) suggestions (free tier) ───────────────────

export interface DadataPartyData {
  inn?: string;
  kpp?: string;
  ogrn?: string;
  hid?: string;
  type?: "LEGAL" | "INDIVIDUAL";
  branch_type?: "MAIN" | "BRANCH";
  branch_count?: number;
  name?: {
    full_with_opf?: string;
    short_with_opf?: string;
    full?: string;
    short?: string;
  };
  address?: {
    value?: string;
    unrestricted_value?: string;
  };
  state?: {
    status?: "ACTIVE" | "LIQUIDATING" | "LIQUIDATED" | "BANKRUPT" | "REORGANIZING";
    actuality_date?: number;
  };
}

export interface DadataPartySuggestion {
  value: string;
  unrestricted_value?: string;
  data: DadataPartyData;
}

/**
 * Suggest organizations (legal entities / sole proprietors) by name or INN.
 * Only head organizations are returned — branches (`branch_type === "BRANCH"`)
 * are filtered out (R4). The KPP of a branch is edited manually if needed.
 */
export async function suggestParty(
  query: string,
  count = 7,
): Promise<DadataPartySuggestion[]> {
  if (!query || query.trim().length < 1) return [];
  const { http, configured } = await getClient(false);
  if (!configured) return [];
  try {
    const { data } = await http.post<{ suggestions: DadataPartySuggestion[] }>(
      SUGGEST_PARTY_URL,
      { query, count },
    );
    return (data.suggestions ?? []).filter((s) => s.data.branch_type !== "BRANCH");
  } catch {
    return [];
  }
}

// ─── Existing address helpers ───────────────────────────────────────

export function dadataToNormalized(d: DadataAddress | null, raw: string): NormalizedAddress {
  if (!d) {
    return { raw, isValid: false };
  }
  return {
    raw,
    postalCode: d.postal_code,
    region: d.region,
    city: d.city,
    street: d.street,
    house: d.house,
    flat: d.flat,
    lat: d.geo_lat ? Number(d.geo_lat) : undefined,
    lon: d.geo_lon ? Number(d.geo_lon) : undefined,
    kladrId: d.kladr_id,
    fiasId: d.fias_id,
    isValid: d.qc === "0",
    qualityCode: d.qc,
    unparsedParts: d.unparsed_parts ? d.unparsed_parts.split(/\s+/).filter(Boolean) : [],
  };
}
