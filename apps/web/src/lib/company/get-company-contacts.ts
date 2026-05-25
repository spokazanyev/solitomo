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

export type CompanyDirector = {
  fullName: string;
  position: string;
  since?: string;
};

export type CompanyOkved = {
  code: string;
  description: string;
};

export type CompanyResponsiblePerson = {
  fullName: string;
  position: string;
  phone?: string;
  email?: string;
};

export type CompanyBanking = {
  bankName: string;
  bik: string;
  correspondentAccount: string;
  settlementAccount: string;
};

export type CompanyContacts = {
  brandName: string;
  legalName: string;
  /** Полное юр.название (для официальных документов, schema.org Organization). */
  legalNameFull?: string;
  inn: string;
  kpp: string;
  ogrn: string;
  /** ОКПО — для счетов и официальной корреспонденции. */
  okpo?: string;
  /** ОКОНХ — устаревший классификатор, иногда требуется в счетах. */
  okonh?: string;
  foundingDate: string;
  /** ISO-date регистрации (для schema.org Organization.foundingDate). */
  registrationDate?: string;
  legalAddress: string;
  actualAddress: string;
  /** Руководитель (для официальных документов и schema.org). */
  director?: CompanyDirector;
  /** Основной ОКВЭД. */
  okvedMain?: CompanyOkved;
  /** Форма собственности: ООО / ИП / etc. */
  form?: string;
  /** Политика по НДС: "НДС обязателен" / "НДС не облагается" / etc. */
  vatPolicy?: string;
  workingHours: string;
  phones: CompanyPhone[];
  emails: CompanyEmail[];
  /** Ответственные лица (руководитель + ключевые контакты). */
  responsiblePersons?: CompanyResponsiblePerson[];
  /** Банковские реквизиты (для PDF-счетов и B2B refund). */
  banking?: CompanyBanking;
  /** Корпоративный сайт (если отличается от текущего деплоя). */
  website?: string;
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
      legalNameFull: parsed.legalNameFull,
      inn: parsed.inn ?? "",
      kpp: parsed.kpp ?? "",
      ogrn: parsed.ogrn ?? "",
      okpo: parsed.okpo,
      okonh: parsed.okonh,
      foundingDate: parsed.foundingDate ?? "",
      registrationDate: parsed.registrationDate,
      legalAddress: parsed.legalAddress ?? "",
      actualAddress: parsed.actualAddress ?? "",
      director: parsed.director,
      okvedMain: parsed.okvedMain,
      form: parsed.form,
      vatPolicy: parsed.vatPolicy,
      workingHours: parsed.workingHours ?? "",
      phones: parsed.phones ?? [],
      emails: parsed.emails ?? [],
      responsiblePersons: parsed.responsiblePersons,
      banking: parsed.banking,
      website: parsed.website,
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
