"use client";

import { useEffect } from "react";

import { trackPhoneClick, trackPhoneDisplayed } from "@/lib/analytics/events";

/**
 * TrackedPhone — обёртка для телефонного номера с analytics-инструментовкой.
 *
 * Соответствие спеке 058:
 * - FR-140: компонент-обёртка для будущего call-tracking подмены номера
 * - FR-141: phone_displayed event при mount (для атрибуции которой кампании
 *   показали какой номер — критично для multi-pool call-tracking)
 * - FR-142: data-attribute slot для подмены call-tracking сервисом
 * - FR-007: phone_click event при клике
 *
 * Usage:
 *   <TrackedPhone number="+78001234567" displayNumber="8 (800) 123-45-67" slot="header" />
 */
interface Props {
  /** Номер для tel:-link (E.164: +78001234567) */
  number: string;
  /** Отображаемый формат («8 (800) 123-45-67»). Если не задан — number. */
  displayNumber?: string;
  /** Слот размещения (header/footer/contacts/pdp) — для FR-141 атрибуции */
  slot: "header" | "footer" | "contacts" | "pdp" | "rfq" | string;
  /** Опциональный CSS-class */
  className?: string;
  /** acquisitionChannel из visit-context (опционально) */
  acquisitionChannel?: string;
}

export function TrackedPhone({
  number,
  displayNumber,
  slot,
  className,
  acquisitionChannel,
}: Props) {
  const display = displayNumber ?? number;

  useEffect(() => {
    // FR-141: phone_displayed — для будущей call-tracking атрибуции (кампания → номер)
    trackPhoneDisplayed({
      displayedNumber: display,
      ctaSlot: slot,
      ...(acquisitionChannel ? { acquisitionChannel } : {}),
    });
  }, [display, slot, acquisitionChannel]);

  const handleClick = () => {
    trackPhoneClick({
      sourcePage: typeof window !== "undefined" ? window.location.pathname : "/",
      ctaSlot: slot,
    });
  };

  return (
    <a
      href={`tel:${number}`}
      className={className}
      data-phone-slot={slot}
      onClick={handleClick}
    >
      {display}
    </a>
  );
}
