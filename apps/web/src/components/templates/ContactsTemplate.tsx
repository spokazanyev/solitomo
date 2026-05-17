import { Building2, Clock, FileText, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

import { getCompanyContacts } from "@/lib/company/get-company-contacts";

function isPlaceholder(value: string) {
  return value.startsWith("TODO(owner)") || value === "";
}

export function ContactsTemplate() {
  const contacts = getCompanyContacts();
  const hasPhones = contacts.phones.length > 0;
  const hasEmails = contacts.emails.length > 0;

  return (
    <div className="grid gap-10">
      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {hasPhones ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Phone className="h-4 w-4 text-sky-700" />
              Телефоны
            </div>
            <div className="mt-4 grid gap-3">
              {contacts.phones.map((phone) => (
                <div key={phone.tel}>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{phone.label}</p>
                  <a
                    className="mt-1 inline-flex text-base font-semibold text-slate-950 hover:text-sky-800"
                    href={`tel:${phone.tel}`}
                  >
                    {phone.value}
                  </a>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {hasEmails ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Mail className="h-4 w-4 text-sky-700" />
              Email
            </div>
            <div className="mt-4 grid gap-3">
              {contacts.emails.map((email) => (
                <div key={email.value}>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{email.label}</p>
                  <a
                    className="mt-1 inline-flex break-all text-base font-semibold text-slate-950 hover:text-sky-800"
                    href={`mailto:${email.value}`}
                  >
                    {email.value}
                  </a>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Clock className="h-4 w-4 text-sky-700" />
            Часы работы
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-700">
            {contacts.workingHours || "Уточняется"}
          </p>
          {contacts.supportPolicy ? (
            <p className="mt-3 text-sm leading-6 text-slate-500">{contacts.supportPolicy}</p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <MapPin className="h-4 w-4 text-sky-700" />
            Адреса
          </div>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Юридический адрес</p>
              <p className="mt-1">{isPlaceholder(contacts.legalAddress) ? "Уточняется" : contacts.legalAddress}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Фактический адрес</p>
              <p className="mt-1">{isPlaceholder(contacts.actualAddress) ? "Уточняется" : contacts.actualAddress}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Building2 className="h-4 w-4 text-sky-700" />
            Реквизиты
          </div>
          <dl className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Юр. наименование</dt>
              <dd className="mt-1">{isPlaceholder(contacts.legalName) ? "Уточняется" : contacts.legalName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">ИНН</dt>
              <dd className="mt-1 font-mono">{isPlaceholder(contacts.inn) ? "—" : contacts.inn}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">КПП</dt>
              <dd className="mt-1 font-mono">{isPlaceholder(contacts.kpp) ? "—" : contacts.kpp}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">ОГРН</dt>
              <dd className="mt-1 font-mono">{isPlaceholder(contacts.ogrn) ? "—" : contacts.ogrn}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-sky-300" />
              Не нашли нужную информацию?
            </div>
            <h2 className="mt-3 text-2xl font-semibold">Отправьте заявку с параметрами</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Опишите задачу, артикулы PDU и сроки. Менеджер подготовит КП, счёт и подтверждающие документы.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-md bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-500"
            href="/b2b/request-quote/"
          >
            Запросить КП
          </Link>
        </div>
      </section>
    </div>
  );
}
