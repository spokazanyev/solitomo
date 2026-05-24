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
