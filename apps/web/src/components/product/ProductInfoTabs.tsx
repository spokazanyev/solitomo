"use client";

import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  Info,
  Ruler,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { getProductAttributeRows } from "@/lib/products/product-attributes";
import type { Product } from "@/lib/products/source-products";

const specGroupOrder = [
  "Электропитание",
  "Розетки",
  "Защита и индикация",
  "Кабель и ввод",
  "Монтаж и размеры",
  "Конструктив",
  "Дополнительно",
];

type TabId = "description" | "documents" | "procurement" | "specs";

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,;:()[\]"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSpecGroupTitle(spec: string) {
  const text = normalizeText(spec);

  if (/розет|гнезд|schuko|cee7|c13|c19/.test(text)) {
    return "Розетки";
  }

  if (/узип|узо|защит|перенапряж|разряд|импульс|индикац|индикатор|выключател|автомат/.test(text)) {
    return "Защита и индикация";
  }

  if (/(?:\d+\s*[aа]\/\d+\s*[вv])|напряж|мощност|ток нагрузки|250в|250v|230в|230v/.test(text)) {
    return "Электропитание";
  }

  if (/кабель|вилка|iec320|iec60309|c20|c14|open end|клемм/.test(text)) {
    return "Кабель и ввод";
  }

  if (/высот|ширин|длин|мм|1u|0u|zero-u|креплен|кронштейн|лоток|стойк/.test(text)) {
    return "Монтаж и размеры";
  }

  if (/корпус|шин|idc|подключ|алюмини/.test(text)) {
    return "Конструктив";
  }

  return "Дополнительно";
}

function groupProductSpecs(specs: string[]) {
  const groups = new Map<string, string[]>();

  specs.forEach((spec) => {
    const cleanSpec = spec.trim();

    if (!cleanSpec) {
      return;
    }

    const title = getSpecGroupTitle(cleanSpec);
    groups.set(title, [...(groups.get(title) ?? []), cleanSpec]);
  });

  return specGroupOrder
    .map((title) => ({ items: groups.get(title) ?? [], title }))
    .filter((group) => group.items.length);
}

function getCleanDescriptionParagraphs(product: Product) {
  const specSet = new Set(product.specs.map(normalizeText));
  const seen = new Set<string>();

  return product.description
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^описание товара$/i.test(line))
    .filter((line) => normalizeText(line) !== normalizeText(product.shortDescription))
    .filter((line) => !specSet.has(normalizeText(line)))
    .filter((line) => {
      const key = normalizeText(line);

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function buildSelectionText(product: Product) {
  const attributes = product.attributes;
  const checks = [
    attributes.maxCurrent.value ? `ток ${attributes.maxCurrent.label}` : "допустимый ток",
    attributes.outletTypes.value?.length ? `розетки ${attributes.outletTypes.label}` : "тип розеток",
    attributes.inputType.value ? `ввод ${attributes.inputType.label}` : "тип ввода",
    attributes.mounting.value ? `монтаж ${attributes.mounting.label}` : "способ монтажа",
  ];

  return `При подборе этой позиции стоит проверить ${checks.join(", ")} и требования к документам. Для КП укажите количество, город поставки и срок.`;
}

function SpecTable({ rows }: { rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950">
        Ключевые параметры для подбора
      </div>
      {rows.map(([label, value]) => (
        <div
          className="grid gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 md:grid-cols-[220px_1fr]"
          key={label}
        >
          <span className="font-medium text-slate-500">{label}</span>
          <span className="leading-6 text-slate-800">{value}</span>
        </div>
      ))}
    </div>
  );
}

function ProductSpecsTab({ product }: { product: Product }) {
  const attributeRows = getProductAttributeRows(product.attributes);
  const specGroups = groupProductSpecs(product.specs);

  return (
    <div className="grid gap-5">
      <SpecTable rows={attributeRows} />
      {specGroups.length ? (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950">
            Детальные характеристики из карточки
          </div>
          <div className="grid gap-4 p-4">
            {specGroups.map((group) => (
              <div className="grid gap-2" key={group.title}>
                <h3 className="text-sm font-semibold text-slate-950">{group.title}</h3>
                <ul className="grid gap-2 text-sm leading-6 text-slate-700">
                  {group.items.map((spec) => (
                    <li className="flex gap-2" key={spec}>
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
                      <span>{spec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <SlidersHorizontal className="h-4 w-4" />
          Что уточнить перед заказом
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            "Ток, ввод и допустимая нагрузка",
            "Тип и количество розеток",
            "Монтаж: 19 дюймов 1U или вертикальный",
            "Документы, срок поставки и город доставки",
          ].map((item) => (
            <div className="flex gap-2 text-sm leading-6 text-slate-700" key={item}>
              <Info className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductDescriptionTab({ product }: { product: Product }) {
  const paragraphs = getCleanDescriptionParagraphs(product);
  const descriptionBlocks = [
    {
      text: product.shortDescription,
      title: "Назначение",
    },
    {
      text: buildSelectionText(product),
      title: "Что проверить перед КП",
    },
    ...paragraphs.map((text, index) => ({
      text,
      title: index === 0 ? "Описание конструкции" : "Дополнительные сведения",
    })),
  ].filter((block) => block.text);

  return (
    <div className="grid gap-3">
      {descriptionBlocks.map((block, index) => (
        <section
          className="rounded-lg border border-slate-200 bg-white p-4"
          key={`${block.title}-${index}`}
        >
          <h3 className="text-sm font-semibold text-slate-950">{block.title}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">{block.text}</p>
        </section>
      ))}
    </div>
  );
}

function ProductDocumentsTab({ product }: { product: Product }) {
  if (!product.documents.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
        Документы по этой модели не привязаны к карточке. Запросите паспорт,
        сертификаты или datasheet вместе с КП.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {product.documents.map((doc) => (
        <a
          className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm font-medium text-slate-800 hover:border-sky-400"
          href={doc.url}
          key={doc.url}
          rel="noreferrer"
          target="_blank"
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-sky-700" />
            {doc.title}
          </span>
          <Download className="h-4 w-4 shrink-0 text-slate-500" />
        </a>
      ))}
    </div>
  );
}

function ProductProcurementTab({ product }: { product: Product }) {
  const rfqHref = `/b2b/request-quote/?sku=${encodeURIComponent(product.sku)}&product=${encodeURIComponent(product.h1)}#rfq-form`;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          {
            Icon: Truck,
            text: "Поставка по России согласуется в КП. Для проекта укажите город, срок и требования к транспортной компании.",
            title: "Доставка",
          },
          {
            Icon: CreditCard,
            text: "Для юридических лиц подготовим коммерческое предложение и счет. Онлайн-оплата подключается отдельным этапом.",
            title: "Оплата",
          },
          {
            Icon: ClipboardList,
            text: "В заявке можно указать количество, ИНН, документы для закупки и техническое задание.",
            title: "Для юрлиц",
          },
        ].map(({ Icon, text, title }) => (
          <section className="rounded-lg border border-slate-200 bg-white p-4" key={title}>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Icon className="h-4 w-4 text-sky-700" />
              {title}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
          </section>
        ))}
      </div>
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-950">
          Что указать, чтобы КП было точным
        </h3>
        <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-700 md:grid-cols-2">
          {[
            "количество и город поставки",
            "тип стойки и способ монтажа",
            "ток, ввод, розетки и запас нагрузки",
            "нужные документы для закупки или тендера",
          ].map((item) => (
            <div className="flex gap-2" key={item}>
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
              {item}
            </div>
          ))}
        </div>
        <Link
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          href={rfqHref}
        >
          Запросить КП по этой модели
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}

export function ProductInfoTabs({ product }: { product: Product }) {
  const [activeTab, setActiveTab] = useState<TabId>("specs");
  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "specs", label: "Характеристики" },
    { id: "description", label: "Описание" },
    { id: "documents", label: `Документы${product.documents.length ? ` (${product.documents.length})` : ""}` },
    { id: "procurement", label: "КП и поставка" },
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-2">
      <div className="flex flex-wrap gap-2 border-b border-slate-100 p-2" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "bg-sky-700 text-white"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            }`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.id === "specs" ? <Ruler className="h-4 w-4" /> : null}
            {tab.id === "description" ? <Info className="h-4 w-4" /> : null}
            {tab.id === "documents" ? <FileText className="h-4 w-4" /> : null}
            {tab.id === "procurement" ? <ClipboardList className="h-4 w-4" /> : null}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-3 md:p-4">
        <div hidden={activeTab !== "specs"} role="tabpanel">
          <ProductSpecsTab product={product} />
        </div>
        <div hidden={activeTab !== "description"} role="tabpanel">
          <ProductDescriptionTab product={product} />
        </div>
        <div hidden={activeTab !== "documents"} role="tabpanel">
          <ProductDocumentsTab product={product} />
        </div>
        <div hidden={activeTab !== "procurement"} role="tabpanel">
          <ProductProcurementTab product={product} />
        </div>
      </div>
    </section>
  );
}
