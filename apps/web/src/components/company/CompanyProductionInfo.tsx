import { getCompanyContacts } from "@/lib/company/get-company-contacts";

/**
 * Production-block on /company/production/.
 *
 * Highlights actual production address (Щорса, 7Р), OKVED and the working
 * hours so an enterprise buyer can validate the supplier before sending a
 * KP/tender request. Numbers come from contacts.json — same source as
 * BankingDetails / CompanyAboutInfo.
 */
export function CompanyProductionInfo() {
  let contacts;
  try {
    contacts = getCompanyContacts();
  } catch {
    return null;
  }
  if (!contacts) return null;

  const { brandName, legalName, actualAddress, workingHours, okvedMain, foundingDate } = contacts;

  return (
    <section className="mt-10 grid gap-6">
      <header className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-semibold text-slate-950">Производство</h2>
        {brandName || legalName ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {brandName ? `Производитель — ${legalName ?? brandName}` : `Производитель — ${legalName}`}
            {foundingDate ? `, работает с ${foundingDate} года.` : "."} Сборка и контроль
            качества выполняются в собственном производственном комплексе в Екатеринбурге.
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {actualAddress ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Адрес производства</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{actualAddress}</p>
            <p className="mt-2 text-xs text-slate-500">
              Самовывоз — по предварительному согласованию с менеджером.
            </p>
          </div>
        ) : null}

        {workingHours ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Режим работы</h3>
            <p className="mt-3 text-sm text-slate-700">{workingHours}</p>
            <p className="mt-2 text-xs text-slate-500">
              Заявки на КП обрабатываются в течение 1 рабочего дня.
            </p>
          </div>
        ) : null}
      </div>

      {okvedMain?.code ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Профиль деятельности</h3>
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
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            Изделия производятся в России. Полный комплект документов
            (паспорт изделия, сертификаты соответствия) — по запросу через
            форму{" "}
            <a className="font-medium text-sky-700 hover:underline" href="/b2b/request-quote/">
              «Запрос КП»
            </a>
            .
          </p>
        </div>
      ) : null}
    </section>
  );
}
