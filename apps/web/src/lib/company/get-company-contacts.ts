import fs from "node:fs";
import path from "node:path";

export type CompanyPhone = {
  label: string;
  value: string;
  tel: string;
  isPrimary: boolean;
};

export type CompanyEmail = {
  label: string;
  value: string;
  isPrimary: boolean;
};

export type CompanySocial = {
  platform: string;
  url: string;
};

export type CompanyGeo = {
  latitude: number;
  longitude: number;
};

export type CompanyContacts = {
  brandName: string;
  legalName: string;
  inn: string;
  kpp: string;
  ogrn: string;
  foundingDate: string;
  legalAddress: string;
  actualAddress: string;
  workingHours: string;
  phones: CompanyPhone[];
  emails: CompanyEmail[];
  socials: CompanySocial[];
  supportPolicy: string;
  publishLocalBusiness: boolean;
  geo: CompanyGeo | null;
  openingHours: string[];
};

const contactsPath = path.join(
  process.cwd(),
  "..",
  "..",
  "00-source-data",
  "company",
  "contacts.json",
);

let cached: CompanyContacts | null = null;

function load(): CompanyContacts {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(contactsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<CompanyContacts>;
    cached = {
      brandName: parsed.brandName ?? "Солитон",
      legalName: parsed.legalName ?? "Солитон",
      inn: parsed.inn ?? "",
      kpp: parsed.kpp ?? "",
      ogrn: parsed.ogrn ?? "",
      foundingDate: parsed.foundingDate ?? "",
      legalAddress: parsed.legalAddress ?? "",
      actualAddress: parsed.actualAddress ?? "",
      workingHours: parsed.workingHours ?? "",
      phones: parsed.phones ?? [],
      emails: parsed.emails ?? [],
      socials: parsed.socials ?? [],
      supportPolicy: parsed.supportPolicy ?? "",
      publishLocalBusiness: Boolean(parsed.publishLocalBusiness),
      geo: parsed.geo ?? null,
      openingHours: parsed.openingHours ?? [],
    };
    return cached;
  } catch (error) {
    console.warn("[company-contacts] using fallback contacts:", error);
    cached = {
      brandName: "Солитон",
      legalName: "Солитон",
      inn: "",
      kpp: "",
      ogrn: "",
      foundingDate: "",
      legalAddress: "",
      actualAddress: "",
      workingHours: "",
      phones: [],
      emails: [],
      socials: [],
      supportPolicy: "",
      publishLocalBusiness: false,
      geo: null,
      openingHours: [],
    };
    return cached;
  }
}

export function getCompanyContacts(): CompanyContacts {
  return load();
}

export function getPrimaryPhone(): CompanyPhone | null {
  const contacts = load();
  return contacts.phones.find((p) => p.isPrimary) ?? contacts.phones[0] ?? null;
}

export function getPrimaryEmail(): CompanyEmail | null {
  const contacts = load();
  return contacts.emails.find((e) => e.isPrimary) ?? contacts.emails[0] ?? null;
}
