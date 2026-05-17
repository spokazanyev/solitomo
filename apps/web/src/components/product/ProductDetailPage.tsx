import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import Link from "next/link";

import { ProductInfoTabs } from "@/components/product/ProductInfoTabs";
import { ProductImageZoom } from "@/components/product/ProductImageZoom";
import { ProductStickyCta } from "@/components/product/ProductStickyCta";
import { AddToRfqButton } from "@/components/rfq/RfqCart";
import {
  createProductBreadcrumbJsonLd,
  createProductJsonLd,
  getRelatedProducts,
  type Product,
} from "@/lib/products/catalog";

type ProductDetailPageProps = {
  product: Product;
};

function JsonLd({ data }: { data: object }) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      type="application/ld+json"
    />
  );
}


function ProductImage({ product }: { product: Product }) {
  const image = product.images[0] || "/placeholders/pdu-silhouette.svg";
  const imageAlt = `${product.h1}, ${product.sku}`;

  return (
    <ProductImageZoom
      alt={imageAlt}
      buttonClassName="group flex aspect-[4/3] w-full cursor-zoom-in items-center justify-center rounded-lg border border-slate-200 bg-white transition hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
      image={image}
      imageClassName="h-full w-full object-contain p-4 transition group-hover:scale-[1.02]"
      images={product.images.length > 0 ? product.images : undefined}
    />
  );
}

function ProductAttributeSummary({ product }: { product: Product }) {
  const rows = [
    ["Тип", product.attributes.productType.label],
    ["Монтаж", product.attributes.mounting.label],
    ["Розетки", product.attributes.outletTypes.label],
    ["Кол-во", product.attributes.outletCount.label],
    ["Ток", product.attributes.maxCurrent.label],
    ["Документы", product.attributes.documents.label],
  ];

  return (
    <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(([label, value]) => (
        <div className="rounded-lg border border-slate-200 bg-white p-3" key={label}>
          <dt className="text-xs font-medium text-slate-500">{label}</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-950">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export async function ProductDetailPage({ product }: ProductDetailPageProps) {
  const relatedProducts = await getRelatedProducts(product);
  const rfqHref = `/b2b/request-quote/?sku=${encodeURIComponent(product.sku)}&product=${encodeURIComponent(product.h1)}#rfq-form`;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-24 text-[var(--foreground)] lg:pb-0">
      <JsonLd data={createProductBreadcrumbJsonLd(product)} />
      <JsonLd data={createProductJsonLd(product)} />
      <ProductStickyCta product={product} rfqHref={rfqHref} />

      <section className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10 lg:px-12">
        <nav className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
          <Link href="/">Главная</Link>
          <span>/</span>
          <Link href="/catalog/pdu/">Каталог</Link>
          {product.categories[0]?.name ? (
            <>
              <span>/</span>
              <span className="text-slate-700">{product.categories[0].name}</span>
            </>
          ) : null}
          <span>/</span>
          <span className="text-slate-700">{product.h1}</span>
        </nav>

        <section className="grid gap-8 py-10 lg:grid-cols-[minmax(0,520px)_1fr_360px]">
          <div>
            <ProductImage product={product} />
            {product.images.length > 1 ? (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {product.images.slice(1, 5).map((image, index) => (
                  <ProductImageZoom
                    alt={`${product.h1}, ${product.sku}`}
                    buttonClassName="group flex aspect-square cursor-zoom-in items-center justify-center rounded-md border border-slate-200 bg-white transition hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    image={image}
                    imageClassName="h-full w-full object-contain p-2 transition group-hover:scale-[1.03]"
                    images={product.images}
                    initialIndex={index + 1}
                    key={`${image}-${index}`}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <p className="mb-4 inline-flex rounded-md bg-sky-50 px-3 py-1 text-sm font-medium text-sky-800">
              {product.categories[0]?.name ?? "PDU Солитон"}
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">
              {product.h1}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              {product.shortDescription}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                {product.sku}
              </span>
              {product.attributes.functions.all.map((badge) => (
                <span
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                  key={badge}
                >
                  {badge}
                </span>
              ))}
            </div>
            <ProductAttributeSummary product={product} />
          </div>

          <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-4">
            <p className="text-sm text-slate-500">
              {product.price.amount === null ? "Цена" : "Ориентировочная цена"}
            </p>
            <p className="mt-1 text-3xl font-semibold text-slate-950">
              {product.price.amount === null ? "По запросу" : product.price.display}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Итоговая стоимость, наличие и срок поставки подтверждаются в КП.
              {/* TODO(owner): добавить priceUpdatedAt из источника данных и показать дату обновления. */}
            </p>
            <div className="mt-4 grid gap-2 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              <div className="flex gap-2">
                <PackageCheck className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
                {product.attributes.availability.label}
              </div>
              <div className="flex gap-2">
                <Truck className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
                {product.attributes.delivery.label}
              </div>
              <div className="flex gap-2">
                <FileText className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
                {product.attributes.documents.label}
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <AddToRfqButton
                className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-800"
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
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:border-sky-700 hover:text-sky-800"
                href={rfqHref}
              >
                Перейти к заявке
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-5 grid gap-2 text-sm leading-6 text-slate-600">
              <div className="flex gap-2">
                <Building2 className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
                Для заказа юрлицом лучше указать количество, город и срок.
              </div>
              <div className="flex gap-2">
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
                Документы и реестр показываются только после подтверждения.
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-4">
          <ProductInfoTabs product={product} />
        </section>

        <section className="mt-12 rounded-lg border border-slate-200 bg-white p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">
                Не уверены, что модель подходит?
              </h2>
              <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-700 md:grid-cols-2">
                {[
                  "Проверим ток, ввод и запас нагрузки.",
                  "Подберем Schuko, C13, C19 или смешанную конфигурацию.",
                  "Согласуем документы, срок и поставку.",
                  "Подготовим КП по SKU или свободному ТЗ.",
                ].map((item) => (
                  <div className="flex gap-2" key={item}>
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-800"
              href={rfqHref}
            >
              Запросить подбор
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-slate-950">Похожие товары</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((item) => (
              <Link
                className="rounded-lg border border-slate-200 bg-white p-4 hover:border-sky-400"
                href={`/product/${item.slug}/`}
                key={item.slug}
              >
                <p className="font-mono text-xs text-slate-500">{item.sku}</p>
                <h3 className="mt-2 text-sm font-semibold leading-6 text-slate-950">
                  {item.h1}
                </h3>
                <p className="mt-3 text-sm font-medium text-sky-800">
                  {item.price.display}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
