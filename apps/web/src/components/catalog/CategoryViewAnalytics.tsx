"use client";

import { useEffect } from "react";

import { trackCategoryView } from "@/lib/analytics/events";

/**
 * CategoryViewAnalytics — client-обёртка для разметки category_view (058 T056).
 *
 * Подключается в RSC `app/(site)/catalog/[...slug]/page.tsx` и подаёт
 * fact-данные категории.
 */
interface Props {
  categorySlug: string;
  itemsCount: number;
}

export function CategoryViewAnalytics({ categorySlug, itemsCount }: Props): null {
  useEffect(() => {
    trackCategoryView({ categorySlug, itemsCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
