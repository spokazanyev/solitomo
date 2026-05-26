import { getCompanyContacts } from "@/lib/company/get-company-contacts";

const RU_DATE = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function safeFormatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    // Fallback for "1992" (year-only) — render as is.
    return iso;
  }
  return RU_DATE.format(date);
}

/**
 * Structured "About the company" block rendered on /company/about/.
 *
 * Reads `00-source-data/company/contacts.json` through `getCompanyContacts()`
 * — single source of truth for legal name / INN / OGRN / founding date /
 * director / OKVED / addresses. Owner cannot drift these into a Lexical body
 * by accident; structured fields stay structured.
 *
 * Pattern intentionally mirrors `BankingDetails` so /company/about/ and
 * /company/contacts/ feel like one design system.
 */
export function CompanyAboutInfo() {
  let contacts;
  try {
    contacts = getCompanyContacts();
  } catch {
    return null;
  }
  if (!contacts) return null;

  const {
    brandName,
    legalName,
    legalNameFull,
    inn,
    kpp,
    ogrn,
    foundingDate,
    registrationDate,
    director,
    okvedMain,
    legalAddress,
    actualAddress,
    workingHours,
    vatPolicy,
  } = contacts;

  return (
    <section className="mt-10 grid gap-6">
      <header className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-semibold text-slate-950">
          О компании {brandName ? `«${brandName}»` : ""}
        </h2>
        {legalNameFull ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Полное наименование: <span className="text-slate-900">{legalNameFull}</span>
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Реквизиты */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Реквизиты</h3>
          <dl className="mt-3 space-y-2 text-sm text-slate-700">
            {legalName ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-slate-500">Сокращённое наименование</dt>
                <dd className="font-medium text-slate-900">{legalName}</dd>
              </div>
            ) : null}
            {inn ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-slate-500">ИНН</dt>
                <dd className="font-mono text-slate-900">{inn}</dd>
              </div>
            ) : null}
            {kpp ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-slate-500">КПП</dt>
                <dd className="font-mono text-slate-900">{kpp}</dd>
              </div>
            ) : null}
            {ogrn ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-slate-500">ОГРН</dt>
                <dd className="font-mono text-slate-900">{ogrn}</dd>
              </div>
            ) : null}
            {vatPolicy ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-slate-500">Налоговый режим</dt>
                <dd className="text-slate-900">{vatPolicy}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {/* История */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">История</h3>
          <dl className="mt-3 space-y-2 text-sm text-slate-700">
            {foundingDate ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-slate-500">Год основания</dt>
                <dd className="text-slate-900">{foundingDate}</dd>
              </div>
            ) : null}
            {registrationDate ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-slate-500">Дата регистрации юр.лица</dt>
                <dd className="text-slate-900">{safeFormatDate(registrationDate)}</dd>
              </div>
            ) : null}
            {director?.fullName ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-slate-500">{director.position || "Директор"}</dt>
                <dd className="font-medium text-slate-900">{director.fullName}</dd>
                {director.since ? (
                  <dd className="text-xs text-slate-500">
                    в должности с {safeFormatDate(director.since)}
                  </dd>
                ) : null}
              </div>
            ) : null}
            {workingHours ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-slate-500">Режим работы</dt>
                <dd className="text-slate-900">{workingHours}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      {/* Адреса */}
      {legalAddress || actualAddress ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Адреса</h3>
          <dl className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            {legalAddress ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-slate-500">Юридический адрес</dt>
                <dd className="text-slate-900">{legalAddress}</dd>
              </div>
            ) : null}
            {actualAddress ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-slate-500">Фактический адрес / производство</dt>
                <dd className="text-slate-900">{actualAddress}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {/* Деятельность */}
      {okvedMain?.code ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Деятельность</h3>
          <dl className="mt-3 space-y-2 text-sm text-slate-700">
            <div className="flex flex-col gap-0.5">
              <dt className="text-slate-500">Основной ОКВЭД</dt>
              <dd className="text-slate-900">
                <span className="font-mono">{okvedMain.code}</span>
                {okvedMain.description ? (
                  <span className="text-slate-700"> — {okvedMain.description}</span>
                ) : null}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
