"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { VisitContext } from "@/lib/analytics/visit-context";

/**
 * AnalyticsContextProvider (058 T020).
 *
 * RSC layout вычисляет VisitContext один раз и передаёт через этот провайдер.
 * Client-components (event-helpers) могут читать его через `useAnalyticsContext`
 * без prop-drilling.
 *
 * В v1 используется опционально — event-helpers сейчас не зависят от context'а
 * напрямую (они получают параметры через явные props). v1.1 переключится на
 * автоматическое прикрепление visit-context-параметров ко всем events.
 */

const AnalyticsContext = createContext<VisitContext | null>(null);

interface Props {
  value: VisitContext;
  children: ReactNode;
}

export function AnalyticsContextProvider({ value, children }: Props) {
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalyticsContext(): VisitContext | null {
  return useContext(AnalyticsContext);
}
