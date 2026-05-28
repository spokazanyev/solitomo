"use client";

import { trackEmailClick } from "@/lib/analytics/events";

/**
 * TrackedEmail — обёртка для email-ссылки с analytics-инструментовкой.
 *
 * Соответствие спеке 058:
 * - FR-007: email_click event при клике
 *
 * Usage:
 *   <TrackedEmail email="sales@soliton.ru" slot="footer" />
 */
interface Props {
  email: string;
  /** Слот размещения */
  slot: "header" | "footer" | "contacts" | "pdp" | string;
  /** Опциональный отображаемый текст; default = email */
  displayText?: string;
  className?: string;
}

export function TrackedEmail({ email, slot, displayText, className }: Props) {
  const handleClick = () => {
    trackEmailClick({
      sourcePage: typeof window !== "undefined" ? window.location.pathname : "/",
      ctaSlot: slot,
    });
  };

  return (
    <a
      href={`mailto:${email}`}
      className={className}
      data-email-slot={slot}
      onClick={handleClick}
    >
      {displayText ?? email}
    </a>
  );
}
