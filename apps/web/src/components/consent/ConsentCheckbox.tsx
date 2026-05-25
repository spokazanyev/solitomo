"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared consent checkbox for forms (checkout, RFQ, signup).
 *
 * 057 US4 — fixes consent in compliance with 152-ФЗ Art. 9.
 * Renders a checkbox + label with links to the offer and privacy policy.
 * The server records the consent snapshot via {@link makeConsentRecord} —
 * this component only handles UI and `onChange` propagation.
 */
export type ConsentCheckboxProps = {
  value: boolean;
  onChange: (v: boolean) => void;
  /** Default `true` — client-side disables submission when unchecked. */
  required?: boolean;
  /** DOM id for the input; default `"consent-checkbox"`. */
  id?: string;
  className?: string;
  /** Override the default label content. */
  label?: ReactNode;
};

const DefaultLabel = (
  <>
    Я согласен с{" "}
    <Link
      href="/info/offer/"
      target="_blank"
      className="text-emerald-700 underline"
    >
      офертой
    </Link>{" "}
    и{" "}
    <Link
      href="/info/pd-policy/"
      target="_blank"
      className="text-emerald-700 underline"
    >
      политикой обработки персональных данных
    </Link>
  </>
);

export function ConsentCheckbox({
  value,
  onChange,
  required = true,
  id = "consent-checkbox",
  className,
  label,
}: ConsentCheckboxProps) {
  const containerClass = [
    "flex items-start gap-3 text-sm text-slate-700",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label htmlFor={id} className={containerClass}>
      <input
        type="checkbox"
        id={id}
        required={required}
        aria-required={required}
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
      />
      <span>{label ?? DefaultLabel}</span>
    </label>
  );
}

export default ConsentCheckbox;
