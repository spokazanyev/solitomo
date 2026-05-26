"use client";

import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MobileDrawer } from "@/components/site/MobileDrawer";
import { AddToRfqButton } from "@/components/rfq/RfqCart";
import { ProductImageZoom } from "@/components/product/ProductImageZoom";
import { trackCategoryView, trackSelectItem, trackViewItemList } from "@/lib/analytics/events";
import { getListingAttributeRows } from "@/lib/products/product-attributes";
import type { Product } from "@/lib/products/catalog";

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

function ProductCard({
  product,
  listId,
  position,
}: {
  product: Product;
  listId: string;
  position: number;
}) {
  const image = product.images[0];
  const imageAlt = `${product.h1}, ${product.sku}`;
  const parameters = getListingAttributeRows(product.attributes);
  const [paramsOpen, setParamsOpen] = useState(false);

  // 058 T027 + FR-003: select_item event при клике по карточке (link to PDP)
  const handleSelect = () => {
    trackSelectItem({
      listId,
      position,
      itemId: product.sku,
      itemName: product.h1,
    });
  };

  return (
    <article className="grid grid-cols-[112px_1fr] gap-x-4 gap-y-3 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-sky-400 md:grid-cols-[112px_minmax(0,1fr)_150px] md:items-start md:gap-4 xl:grid-cols-[128px_minmax(0,1fr)_180px]">
      <ProductImageZoom
        alt={imageAlt}
        buttonClassName="group col-start-1 row-start-1 flex aspect-square cursor-zoom-in items-center justify-center rounded-md border border-slate-100 bg-slate-50 transition hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
        image={image || "/placeholders/pdu-silhouette.svg"}
        imageClassName="h-full w-full object-contain p-2 transition group-hover:scale-[1.03]"
        images={product.images.length > 0 ? product.images : undefined}
      />
      <div className="col-start-2 row-start-1 min-w-0">
        <p className="font-mono text-xs text-slate-500">{product.sku}</p>
        <Link href={`/product/${product.slug}/`} onClick={handleSelect}>
          <h3 className="mt-1 text-base font-semibold leading-6 text-slate-950 hover:text-sky-800">
            {product.h1}
          </h3>
        </Link>
        <div className="mt-2 flex flex-wrap gap-1.5 md:mt-3 md:gap-2">
          {product.attributes.functions.all.slice(0, 3).map((badge) => (
            <span
              className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800"
              key={badge}
            >
              {badge}
            </span>
          ))}
        </div>
        <button
          aria-controls={`product-params-${product.slug}`}
          aria-expanded={paramsOpen}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900 md:hidden"
          onClick={() => setParamsOpen((value) => !value)}
          type="button"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition ${paramsOpen ? "rotate-180" : "rotate-0"}`}
          />
          {paramsOpen ? "Скрыть параметры" : "Параметры и описание"}
        </button>
        <div
          className={`${paramsOpen ? "block" : "hidden"} md:block`}
          id={`product-params-${product.slug}`}
        >
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-3">
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
      </div>
      <div className="col-span-2 grid gap-3 md:col-span-1 md:col-start-3 md:row-start-1 md:min-w-0 md:justify-items-stretch md:gap-3">
        <div className="flex items-baseline justify-between gap-3 md:flex-col md:items-end md:gap-1">
          <p className="text-sm font-semibold text-sky-800">{product.price.display}</p>
          <p className="text-right text-xs leading-5 text-slate-500">
            {product.attributes.availability.label}
          </p>
        </div>
        <div className="flex gap-2 md:flex-col md:gap-3">
          <div className="flex-1 md:w-full">
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
          </div>
          <Link
            className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:border-sky-700 hover:text-sky-800 md:w-full md:flex-none"
            href={`/product/${product.slug}/`}
          >
            Открыть
          </Link>
        </div>
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
      {products.map((product, idx) => (
        <ProductCard
          key={product.slug}
          listId="catalog_main"
          position={idx + 1}
          product={product}
        />
      ))}
    </div>
  );
}

export function CatalogFilterableList({
  facetGroups,
  products,
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

  // 058 T056 + FR-001: category_view event при первом рендере на category-page
  useEffect(() => {
    if (typeof window === "undefined") return;
    const match = window.location.pathname.match(/\/catalog\/([^/]+)\/?/);
    if (match?.[1]) {
      trackCategoryView({ categorySlug: match[1], itemsCount: sortedProducts.length });
    }
    // run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 058 T026 + FR-002: view_item_list event при отображении (или изменении filter/sort)
  // Limit first 20 items в payload — для коротких HTTP-request'ов и Webvisor.
  useEffect(() => {
    if (sortedProducts.length === 0) return;
    const itemsForEvent = sortedProducts.slice(0, 20).map((p, idx) => {
      const item: {
        itemId: string;
        itemName: string;
        position: number;
        category?: string;
        price?: number;
      } = {
        itemId: p.sku,
        itemName: p.h1,
        position: idx + 1,
      };
      const firstCategoryUrl = p.categories[0]?.url;
      if (firstCategoryUrl) {
        const slugMatch = firstCategoryUrl.match(/\/catalog\/([^/]+)\/?$/);
        if (slugMatch?.[1]) item.category = slugMatch[1];
      }
      if (typeof p.price.amount === "number") item.price = p.price.amount;
      return item;
    });
    trackViewItemList({
      listId: "catalog_main",
      listName: "Catalog",
      items: itemsForEvent,
    });
    // Зависимость на длину + sortMode (не на full array, чтобы не повторно стрелять при equal reorder)
  }, [sortedProducts.length, sortMode]);

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

  const filtersContent = (
    <div className="grid gap-4 lg:gap-2">
      {facetGroups.map((group) => {
        const selectedInGroup = group.options.filter((option) =>
          selectedPathSet.has(option.path),
        );
        const collapsed = collapsedGroups.includes(group.label);

        return (
          <fieldset
            className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0 lg:pt-2"
            key={group.label}
          >
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
              <div className="mt-2 grid gap-1 lg:mt-1 lg:gap-0">
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
                      className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 text-sm lg:min-h-7 lg:py-0.5 lg:text-[13px] ${
                        checked
                          ? "bg-sky-50 font-semibold text-sky-800"
                          : disabled
                            ? "cursor-not-allowed text-slate-300"
                            : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                      }`}
                      key={option.path}
                    >
                      <span className="flex min-w-0 items-center gap-3 lg:gap-2">
                        <input
                          checked={checked}
                          className="h-5 w-5 rounded border-slate-300 text-sky-700 focus:ring-sky-600 disabled:border-slate-200 lg:h-3.5 lg:w-3.5"
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
  );

  const filterHeader = (
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
        Сбросить
      </button>
    </div>
  );

  return (
    <section className="grid gap-6 lg:grid-cols-[240px_1fr] xl:grid-cols-[280px_1fr]">
      {/* Mobile/tablet trigger button (≤lg) */}
      <div className="lg:hidden">
        <button
          aria-controls="catalog-filters-drawer"
          aria-expanded={mobileFiltersOpen}
          className="inline-flex h-12 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-sky-500"
          onClick={() => setMobileFiltersOpen(true)}
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
            Открыть
          </span>
        </button>
      </div>

      {/* Desktop sidebar (≥lg) — без визуального фрейма, просто колонка */}
      <aside
        id="catalog-filters"
        className="hidden self-start lg:block lg:pr-2"
      >
        {filterHeader}
        <div className="mt-3">{filtersContent}</div>
      </aside>

      {/* Mobile/tablet drawer */}
      <div id="catalog-filters-drawer" className="lg:hidden">
        <MobileDrawer
          footer={
            <div className="flex gap-3">
              <button
                className="inline-flex h-12 flex-1 items-center justify-center gap-1 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:border-sky-500 hover:text-sky-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                disabled={selectedPaths.length === 0}
                onClick={clearFilters}
                type="button"
              >
                <X className="h-4 w-4" />
                Сбросить
              </button>
              <button
                className="inline-flex h-12 flex-1 items-center justify-center rounded-md bg-sky-700 px-3 text-sm font-semibold text-white hover:bg-sky-800"
                onClick={() => setMobileFiltersOpen(false)}
                type="button"
              >
                Показать ({filteredProducts.length})
              </button>
            </div>
          }
          onClose={() => setMobileFiltersOpen(false)}
          open={mobileFiltersOpen}
          side="right"
          title="Фильтры"
        >
          {filtersContent}
        </MobileDrawer>
      </div>

      <div>
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
          <p className="text-sm text-slate-500">
            Показано моделей: {filteredProducts.length} из {total}
          </p>
          <label className="grid gap-1 text-xs font-medium text-slate-500 md:min-w-52">
            Сортировка
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
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
                className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100"
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
