import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { AddToRfqButton } from "@/components/rfq/RfqCart";
import type { Product } from "@/lib/products/catalog";

type ProductStickyCtaProps = {
  product: Product;
  rfqHref: string;
};

export function ProductStickyCta({ product, rfqHref }: ProductStickyCtaProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white shadow-[0_-4px_16px_rgba(15,23,42,0.06)] lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-slate-500">
            {product.price.amount === null ? "Цена" : "Ориентировочно"}
          </p>
          <p className="truncate text-base font-semibold text-slate-950">
            {product.price.amount === null ? "По запросу" : product.price.display}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AddToRfqButton
            addedClassName="inline-flex h-11 items-center justify-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-3 text-sm font-semibold text-sky-900 hover:bg-sky-100"
            className="inline-flex h-11 items-center justify-center gap-1 rounded-md bg-sky-700 px-3 text-sm font-semibold text-white hover:bg-sky-800"
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
            aria-label="Перейти к заявке КП"
            className="inline-flex h-11 items-center justify-center gap-1 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:border-sky-700 hover:text-sky-800"
            href={rfqHref}
          >
            КП
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
