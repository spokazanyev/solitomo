import { getCompanyContacts } from "@/lib/company/get-company-contacts";

function formatSinceDate(iso?: string): string | null {
  if (!iso) return null;
  // Expect ISO date like "2002-11-29"; convert to DD.MM.YYYY.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}

export function BankingDetails() {
  let contacts;
  try {
    contacts = getCompanyContacts();
  } catch {
    return null;
  }
  if (!contacts) return null;

  const { banking, director, okpo, okonh, okvedMain } = contacts;

  const hasBanking = Boolean(banking);
  const hasDirector = Boolean(director?.fullName);
  const hasExtra = Boolean(okpo || okonh || okvedMain?.code);

  if (!hasBanking && !hasDirector && !hasExtra) return null;

  const sinceFormatted = formatSinceDate(director?.since);

  return (
    <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {hasBanking && banking ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">
            Банковские реквизиты
          </h3>
          <dl className="mt-3 space-y-2 text-sm text-slate-700">
            <div className="flex flex-col gap-0.5">
              <dt className="text-slate-500">Банк</dt>
              <dd className="font-medium text-slate-900">{banking.bankName}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-slate-500">БИК</dt>
              <dd className="font-mono text-slate-900">{banking.bik}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-slate-500">К/с</dt>
              <dd className="font-mono text-slate-900">
                {banking.correspondentAccount}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-slate-500">Р/с</dt>
              <dd className="font-mono text-slate-900">
                {banking.settlementAccount}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {hasDirector && director ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Руководитель</h3>
          <dl className="mt-3 space-y-2 text-sm text-slate-700">
            <div className="flex flex-col gap-0.5">
              <dt className="text-slate-500">
                {director.position || "Директор"}
              </dt>
              <dd className="font-medium text-slate-900">{director.fullName}</dd>
            </div>
            {sinceFormatted ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-slate-500">В должности</dt>
                <dd className="text-slate-900">с {sinceFormatted}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {hasExtra ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">
            Дополнительные реквизиты
          </h3>
          <dl className="mt-3 space-y-2 text-sm text-slate-700">
            {okpo ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-slate-500">ОКПО</dt>
                <dd className="font-mono text-slate-900">{okpo}</dd>
              </div>
            ) : null}
            {okonh ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-slate-500">ОКОНХ</dt>
                <dd className="font-mono text-slate-900">{okonh}</dd>
              </div>
            ) : null}
            {okvedMain?.code ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-slate-500">Основной ОКВЭД</dt>
                <dd className="text-slate-900">
                  <span className="font-mono">{okvedMain.code}</span>
                  {okvedMain.description ? (
                    <span className="text-slate-700">
                      {" "}
                      — {okvedMain.description}
                    </span>
                  ) : null}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </section>
  );
}
