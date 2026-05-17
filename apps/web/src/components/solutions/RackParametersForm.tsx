"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type CurrentChoice = "16a" | "32a" | "3ph";
type OutletChoice = "schuko" | "c13" | "c19" | "mixed";

const catalogByCurrent: Record<CurrentChoice, string> = {
  "16a": "/catalog/16a/",
  "32a": "/catalog/32a/",
  "3ph": "/catalog/three-phase-pdu/",
};

const catalogByOutlet: Record<OutletChoice, string> = {
  schuko: "/catalog/schuko/",
  c13: "/catalog/iec-c13-c19/",
  c19: "/catalog/iec-c13-c19/",
  mixed: "/catalog/pdu/",
};

export function RackParametersForm() {
  const [rackUnits, setRackUnits] = useState<string>("42");
  const [current, setCurrent] = useState<CurrentChoice>("16a");
  const [outlet, setOutlet] = useState<OutletChoice>("c13");
  const [monitoring, setMonitoring] = useState(false);
  const [surge, setSurge] = useState(false);
  const [notSure, setNotSure] = useState(false);

  const target = useMemo(() => {
    if (notSure) {
      const comment = encodeURIComponent(
        `Параметры стойки: ${rackUnits}U, ${current.toUpperCase()}, ${outlet.toUpperCase()}` +
          (monitoring ? ", нужен мониторинг" : "") +
          (surge ? ", нужен УЗИП" : ""),
      );
      return `/b2b/request-quote/?comment=${comment}#rfq-form`;
    }
    if (surge) return "/catalog/pdu-uzip/";
    if (monitoring) return "/catalog/metered-pdu/";
    return catalogByOutlet[outlet] || catalogByCurrent[current];
  }, [current, monitoring, notSure, outlet, rackUnits, surge]);

  return (
    <form
      aria-label="Параметры стойки для подбора PDU"
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <p className="text-sm font-semibold text-slate-950">Параметры стойки</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Заполните вводные — мы откроем подходящий раздел каталога или подготовим заявку на КП.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Высота стойки (U)
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
            inputMode="numeric"
            min={1}
            onChange={(event) => setRackUnits(event.target.value)}
            type="number"
            value={rackUnits}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Ток ввода
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:border-sky-600 focus:outline-none"
            onChange={(event) => setCurrent(event.target.value as CurrentChoice)}
            value={current}
          >
            <option value="16a">16A</option>
            <option value="32a">32A</option>
            <option value="3ph">Трёхфазный</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Тип розеток
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:border-sky-600 focus:outline-none"
            onChange={(event) => setOutlet(event.target.value as OutletChoice)}
            value={outlet}
          >
            <option value="schuko">Schuko</option>
            <option value="c13">IEC C13</option>
            <option value="c19">IEC C19</option>
            <option value="mixed">Смешанные</option>
          </select>
        </label>
        <fieldset className="grid gap-2 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input
              checked={monitoring}
              onChange={(event) => setMonitoring(event.target.checked)}
              type="checkbox"
            />
            Нужен мониторинг
          </label>
          <label className="flex items-center gap-2">
            <input
              checked={surge}
              onChange={(event) => setSurge(event.target.checked)}
              type="checkbox"
            />
            Нужна защита (УЗИП)
          </label>
          <label className="flex items-center gap-2">
            <input
              checked={notSure}
              onChange={(event) => setNotSure(event.target.checked)}
              type="checkbox"
            />
            Не уверен — нужна помощь
          </label>
        </fieldset>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {notSure
            ? "Параметры уйдут в комментарий к заявке на КП"
            : "Откроем подходящий раздел каталога"}
        </p>
        <Link
          className="inline-flex items-center gap-2 rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          href={target}
        >
          {notSure ? "Перейти к заявке" : "Открыть каталог"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </form>
  );
}
