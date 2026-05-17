import { ArrowRight, CheckCircle2, FileText } from "lucide-react";
import Link from "next/link";

type ComparisonCriterion = {
  label: string;
  competitor: string;
  soliton: string;
};

type ComparisonPlaceholderProps = {
  vendorLabel: string;
  rfqComment: string;
  criteria?: ComparisonCriterion[];
};

const defaultCriteria: ComparisonCriterion[] = [
  {
    label: "Розетки",
    competitor: "Schuko, IEC C13/C19, проприетарные",
    soliton: "Schuko, IEC C13, IEC C19, смешанные",
  },
  {
    label: "Ток",
    competitor: "16A / 32A / трёхфазный",
    soliton: "16A / 32A / трёхфазный",
  },
  {
    label: "Монтаж",
    competitor: "1U 19″, вертикальный 0U",
    soliton: "1U 19″, вертикальный 0U / 42U",
  },
  {
    label: "Мониторинг / SNMP",
    competitor: "Доступно в старших сериях",
    soliton: "Доступно в измерительных и управляемых моделях",
  },
  {
    label: "Реестр Минпромторга",
    competitor: "Не входит",
    soliton: "Сведения предоставляются по моделям",
  },
  {
    label: "Производство",
    competitor: "Импорт (ограниченные поставки в РФ)",
    soliton: "Россия, с 2006 года",
  },
];

export function ComparisonPlaceholder({
  vendorLabel,
  rfqComment,
  criteria = defaultCriteria,
}: ComparisonPlaceholderProps) {
  const rfqHref = `/b2b/request-quote/?comment=${encodeURIComponent(rfqComment)}#rfq-form`;

  return (
    <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 lg:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-md bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-800">
          <FileText className="h-3.5 w-3.5" />
          Сравнение по критериям
        </div>
        <span className="rounded-md bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
          Подробное сравнение моделей дополняется
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-3 pr-4 font-semibold">Параметр</th>
              <th className="py-3 pr-4 font-semibold">{vendorLabel}</th>
              <th className="py-3 pr-4 font-semibold text-sky-800">Солитон</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {criteria.map((row) => (
              <tr className="border-b border-slate-100" key={row.label}>
                <td className="py-3 pr-4 font-medium text-slate-950">{row.label}</td>
                <td className="py-3 pr-4">{row.competitor}</td>
                <td className="py-3 pr-4 text-slate-950">
                  <span className="inline-flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
                    {row.soliton}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 rounded-lg bg-slate-50 p-5 text-sm leading-6 text-slate-700 lg:grid-cols-[1fr_auto] lg:items-center">
        <span>
          Отправьте артикул заменяемой модели и параметры стойки — менеджер с инженером
          подберёт прямой серийный аналог или сборку под задачу.
        </span>
        <Link
          className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-800"
          href={rfqHref}
        >
          Запросить замену
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
