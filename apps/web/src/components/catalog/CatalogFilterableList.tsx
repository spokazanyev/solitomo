"use client";

import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AddToRfqButton } from "@/components/rfq/RfqCart";
import { getListingAttributeRows } from "@/lib/products/product-attributes";
import type { Product } from "@/lib/products/source-products";

type FacetOption = {
  count: number;
  current: boolean;
  label: string;
  path: string;
};

type FacetGroup = {
  label: string;
  options: FacetOption[];
};

type CatalogFilterableListProps = {
  description: string;
  facetGroups: FacetGroup[];
  products: Product[];
  title: string;
  total: number;
};

type SortMode = "default" | "outlets_desc" | "price_asc" | "price_desc";

function productMatchesFacet(product: Product, path: string) {
  const outletCountMatch = path.match(/^\/catalog\/outlet-count-(\d+)\/$/);

  if (outletCountMatch) {
    return product.attributes.outletCount.value === Number.parseInt(outletCountMatch[1] ?? "", 10);
  }

  const attributes = product.attributes;

  switch (path) {
    case "/catalog/bloki-rozetok-19-1u/":
      return attributes.mounting.value === "rack_19_1u";
    case "/catalog/vertical-pdu/":
      return attributes.mounting.value === "vertical";
    case "/catalog/16a/":
      return attributes.maxCurrent.value === 16;
    case "/catalog/32a/":
      return attributes.maxCurrent.value === 32;
    case "/catalog/three-phase-pdu/":
      return attributes.phase.value === 3;
    case "/catalog/schuko/":
      return attributes.outletTypes.value?.includes("Schuko") ?? false;
    case "/catalog/iec-c13-c19/":
      return Boolean(
        attributes.outletTypes.value?.some((value) =>
          ["IEC C13", "IEC C19"].includes(value),
        ),
      );
    case "/catalog/metered-pdu/":
      return (
        attributes.functions.monitoring.length > 0 ||
        attributes.productType.value === "monitoring_controller"
      );
    case "/catalog/managed-pdu/":
      return attributes.functions.management.length > 0;
    case "/catalog/pdu-uzip/":
      return (
        attributes.functions.protection.length > 0 ||
        attributes.productType.value === "surge_filter"
      );
    default:
      return true;
  }
}

function filterProducts(products: Product[], groups: FacetGroup[], selectedPaths: Set<string>) {
  if (selectedPaths.size === 0) {
    return products;
  }

  const activeGroups = groups
    .map((group) => ({
      label: group.label,
      paths: group.options
        .filter((option) => selectedPaths.has(option.path))
        .map((option) => option.path),
    }))
    .filter((group) => group.paths.length > 0);

  return products.filter((product) =>
    activeGroups.every((group) =>
      group.paths.some((path) => productMatchesFacet(product, path)),
    ),
  );
}

function countProductsForOption(
  products: Product[],
  groups: FacetGroup[],
  selectedPaths: Set<string>,
  currentGroup: FacetGroup,
  optionPath: string,
) {
  const currentGroupPaths = new Set(currentGroup.options.map((option) => option.path));
  const selectedForCount = new Set(
    Array.from(selectedPaths).filter((path) => !currentGroupPaths.has(path)),
  );

  selectedForCount.add(optionPath);

  return filterProducts(products, groups, selectedForCount).length;
}

function sortProducts(products: Product[], sortMode: SortMode) {
  const withKnownPrice = (product: Product) => product.price.amount ?? Number.POSITIVE_INFINITY;

  return [...products].sort((a, b) => {
    if (sortMode === "price_asc") {
      return withKnownPrice(a) - withKnownPrice(b) || a.h1.localeCompare(b.h1, "ru");
    }

    if (sortMode === "price_desc") {
      return (b.price.amount ?? 0) - (a.price.amount ?? 0) || a.h1.localeCompare(b.h1, "ru");
    }

    if (sortMode === "outlets_desc") {
      return (
        (b.attributes.outletCount.value ?? 0) -
          (a.attributes.outletCount.value ?? 0) ||
        a.h1.localeCompare(b.h1, "ru")
      );
    }

    return a.h1.localeCompare(b.h1, "ru");
  });
}

function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  const parameters = getListingAttributeRows(product.attributes);

  return (
    <article className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-sky-400 md:grid-cols-[128px_1fr_180px] md:items-start">
      <div className="flex aspect-square items-center justify-center rounded-md border border-slate-100 bg-slate-50">
        {/* Cached legacy assets from soliton1.ru, served from /public/legacy/. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={`${product.h1}, ${product.sku}`}
          className="h-full w-full object-contain p-2"
          loading="lazy"
          decoding="async"
          src={image || "/placeholders/pdu-silhouette.svg"}
        />
      </div>
      <div>
        <p className="font-mono text-xs text-slate-500">{product.sku}</p>
        <Link href={`/product/${product.slug}/`}>
          <h3 className="mt-1 text-base font-semibold leading-6 text-slate-950 hover:text-sky-800">
            {product.h1}
          </h3>
        </Link>
        <div className="mt-3 flex flex-wrap gap-2">
          {product.attributes.functions.all.slice(0, 3).map((badge) => (
            <span
              className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800"
              key={badge}
            >
              {badge}
            </span>
          ))}
        </div>
        <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {parameters.map(([label, value]) => (
            <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5" key={label}>
              <dt className="text-slate-500">{label}</dt>
              <dd className="mt-0.5 font-medium text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
          {product.shortDescription}
        </p>
      </div>
      <div className="grid gap-3 md:min-w-36 md:justify-items-end">
        <p className="text-sm font-semibold text-sky-800">{product.price.display}</p>
        <p className="text-right text-xs leading-5 text-slate-500">
          {product.attributes.availability.label}
        </p>
        <AddToRfqButton
          item={{
            name: product.h1,
            quantity: "1",
            sku: product.sku,
            price: product.price.amount,
            slug: product.slug,
            image: product.images[0],
          }}
        />
        <Link
          className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-sky-700 hover:text-sky-800"
          href={`/product/${product.slug}/`}
        >
          Открыть
        </Link>
      </div>
    </article>
  );
}

function CatalogProductList({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
        По выбранным параметрам нет опубликованных моделей. Уберите часть фильтров
        или отправьте параметры стойки, чтобы получить подбор и КП.
        <Link
          className="mt-3 inline-flex items-center rounded-md bg-amber-900 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-950"
          href="/b2b/request-quote/"
        >
          Отправить параметры на подбор
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </div>
  );
}

export function CatalogFilterableList({
  description,
  facetGroups,
  products,
  title,
  total,
}: CatalogFilterableListProps) {
  const initialSelectedPaths = useMemo(
    () =>
      facetGroups
        .flatMap((group) => group.options)
        .filter((option) => option.current)
        .map((option) => option.path),
    [facetGroups],
  );
  const [selectedPaths, setSelectedPaths] = useState<string[]>(initialSelectedPaths);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const selectedPathSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const filteredProducts = useMemo(
    () => filterProducts(products, facetGroups, selectedPathSet),
    [facetGroups, products, selectedPathSet],
  );
  const sortedProducts = useMemo(
    () => sortProducts(filteredProducts, sortMode),
    [filteredProducts, sortMode],
  );
  const selectedOptions = facetGroups.flatMap((group) =>
    group.options
      .filter((option) => selectedPathSet.has(option.path))
      .map((option) => ({ group: group.label, ...option })),
  );

  function togglePath(path: string) {
    setSelectedPaths((current) =>
      current.includes(path)
        ? current.filter((item) => item !== path)
        : [...current, path],
    );
  }

  function clearFilters() {
    setSelectedPaths([]);
  }

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  function toggleGroup(label: string) {
    setCollapsedGroups((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label],
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="lg:hidden">
        <button
          aria-expanded={mobileFiltersOpen}
          aria-controls="catalog-filters"
          className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-sky-500"
          onClick={() => setMobileFiltersOpen((value) => !value)}
          type="button"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Фильтры
            {selectedPaths.length > 0 ? (
              <span className="rounded-full bg-sky-600 px-2 py-0.5 text-xs font-semibold text-white">
                {selectedPaths.length}
              </span>
            ) : null}
          </span>
          <span className="text-xs uppercase tracking-wide text-slate-400">
            {mobileFiltersOpen ? "Скрыть" : "Показать"}
          </span>
        </button>
      </div>
      <aside
        id="catalog-filters"
        className={`max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 overscroll-contain lg:sticky lg:top-4 lg:block ${mobileFiltersOpen ? "block" : "hidden"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <SlidersHorizontal className="h-4 w-4" />
            Фильтры для каталога
          </div>
          <button
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:border-sky-500 hover:text-sky-800 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
            disabled={selectedPaths.length === 0}
            onClick={clearFilters}
            type="button"
          >
            <X className="h-3.5 w-3.5" />
            Сбросить все
          </button>
        </div>
        <div className="mt-5 grid gap-5">
          {facetGroups.map((group) => {
            const selectedInGroup = group.options.filter((option) =>
              selectedPathSet.has(option.path),
            );
            const collapsed = collapsedGroups.includes(group.label);

            return (
              <fieldset className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0" key={group.label}>
                <legend className="sr-only">{group.label}</legend>
                <button
                  aria-expanded={!collapsed}
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() => toggleGroup(group.label)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      {group.label}
                      {selectedInGroup.length > 0 ? (
                        <span
                          aria-label="Фильтр задействован"
                          className="h-2 w-2 rounded-full bg-sky-600"
                        />
                      ) : null}
                    </span>
                    {selectedInGroup.length > 0 ? (
                      <span className="mt-1 block truncate text-xs leading-5 text-sky-800">
                        {selectedInGroup.map((option) => option.label).join(", ")}
                      </span>
                    ) : null}
                  </span>
                  <ChevronDown
                    className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition ${collapsed ? "-rotate-90" : "rotate-0"}`}
                  />
                </button>
                {collapsed ? null : (
                  <div className="mt-2 grid gap-2">
                    {group.options.map((option) => {
                      const checked = selectedPathSet.has(option.path);
                      const count = countProductsForOption(
                        products,
                        facetGroups,
                        selectedPathSet,
                        group,
                        option.path,
                      );
                      const disabled = count === 0 && !checked;

                      return (
                        <label
                          className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1 text-sm ${
                            checked
                              ? "bg-sky-50 font-semibold text-sky-800"
                              : disabled
                                ? "cursor-not-allowed text-slate-300"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                          }`}
                          key={option.path}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <input
                              checked={checked}
                              className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600 disabled:border-slate-200"
                              disabled={disabled}
                              onChange={() => togglePath(option.path)}
                              type="checkbox"
                            />
                            <span className="min-w-0">{option.label}</span>
                          </span>
                          <span className="text-xs text-slate-400">{count}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </fieldset>
            );
          })}
        </div>
      </aside>
      <div>
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Показано моделей: {filteredProducts.length} из {total}
            </p>
            <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>
          <label className="grid gap-1 text-xs font-medium text-slate-500 md:min-w-52">
            Сортировка
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              value={sortMode}
            >
              <option value="default">По названию</option>
              <option value="outlets_desc">Больше розеток</option>
              <option value="price_asc">Цена по возрастанию</option>
              <option value="price_desc">Цена по убыванию</option>
            </select>
          </label>
        </div>
        {selectedOptions.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedOptions.map((option) => (
              <button
                className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100"
                key={`${option.group}-${option.path}`}
                onClick={() => togglePath(option.path)}
                type="button"
              >
                {option.label}
                <X className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-5">
          <CatalogProductList products={sortedProducts} />
        </div>
      </div>
    </section>
  );
}
