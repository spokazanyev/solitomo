"use client";

import { useEffect } from "react";

import { trackViewItem } from "@/lib/analytics/data-layer";
import {
  trackPriceRequestClick,
  trackPriceView,
  trackStockStatusView,
} from "@/lib/analytics/events";

/**
 * Client-обёртка для analytics-разметки PDP (T028, 058 Phase 3 US1).
 *
 * При mount (≈page-view) отправляет:
 * - `view_item` event + `ecommerce.detail` dual-push (FR-110)
 * - `price_view` (если цена публична) ИЛИ `price_request_click` нет (FR-190).
 *   ВАЖНО: `price_request_click` срабатывает при показе CTA «Запросить цену»,
 *   а не при клике (real click — отдельный event на кнопке).
 *   Здесь мы используем только для view-сигнала «у товара нет публичной цены».
 *   Альтернатива (более точная): trackPriceRequestClick при клике на CTA.
 *   В v1 — упрощённо: при mount без публичной цены = price_request_click signal.
 * - `stock_status_view` со статусом наличия (FR-191).
 *
 * Рендерит `null` — пользователь его не видит.
 */
interface Props {
  sku: string;
  name: string;
  /** Цена в рублях; null = публичной цены нет (товар «по запросу») */
  priceAmount: number | null;
  /** Categories[0]?.slug или slug первой категории — для category_slug parameter */
  categorySlug?: string;
  brand?: string;
  /** v1: каталог не имеет stock-tracking → 'unknown'. Будет уточнён при появлении stock-data. */
  stockStatus?: "in_stock" | "on_order" | "out_of_stock" | "unknown";
}

export function ProductDetailAnalytics({
  sku,
  name,
  priceAmount,
  categorySlug,
  brand,
  stockStatus = "unknown",
}: Props): null {
  useEffect(() => {
    // FR-110: view_item event + ecommerce.detail dual-push
    trackViewItem({
      sku,
      name,
      price: priceAmount, // null преобразуется в undefined внутри helper'а
      ...(categorySlug ? { category: categorySlug } : {}),
      ...(brand ? { brand } : {}),
    });

    // FR-190: B2B-сигнал price visibility
    if (priceAmount !== null && priceAmount > 0) {
      trackPriceView({ sku, ...(categorySlug ? { categorySlug } : {}) });
    } else {
      trackPriceRequestClick({ sku, ...(categorySlug ? { categorySlug } : {}) });
    }

    // FR-191: B2B-сигнал stock visibility
    trackStockStatusView({ sku, stockStatus });
    // SKU/категория стабильны при mount; не подписываемся на изменения
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
