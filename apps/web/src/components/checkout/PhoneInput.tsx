"use client";

import { AsYouType, isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";
import { useId, useState } from "react";

interface Props {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  /** Default country to assume when the user enters a national-format number. */
  defaultCountry?: "RU" | "BY" | "KZ" | "UA";
  /**
   * Notify parent whether the current value is a valid phone number. Useful
   * for the submit-button disabled state. Called on every change.
   */
  onValidityChange?: (isValid: boolean) => void;
}

/**
 * Controlled phone input with live formatting (libphonenumber-js AsYouType)
 * and a soft, on-blur validity hint. We do NOT block typing — partial
 * numbers must remain editable. The submit button is the place that
 * enforces `isValidPhoneNumber`, by calling `onValidityChange`.
 *
 * Storage shape: the raw E.164 string is what we hand back via `onChange`
 * once the number parses; while it's incomplete we hand back the raw text
 * with AsYouType formatting applied so the field looks natural mid-typing.
 *
 * Why not DaData here: DaData phone normalization is a paid `cleaner` tier
 * call. libphonenumber-js does the same formatting/validation offline at
 * ~30 KB gzipped — no API budget consumed and no network dependency.
 */
export function PhoneInput({
  value,
  onChange,
  label,
  required,
  className = "",
  inputClassName = "rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none",
  defaultCountry = "RU",
  onValidityChange,
}: Props) {
  const inputId = useId();
  const [touched, setTouched] = useState(false);

  function format(input: string): string {
    // AsYouType handles partial input gracefully and adds spaces/parens.
    const formatter = new AsYouType(defaultCountry);
    return formatter.input(input);
  }

  function handleChange(raw: string) {
    const formatted = format(raw);
    onChange(formatted);
    if (onValidityChange) {
      const valid = isValidPhoneNumber(formatted, defaultCountry);
      onValidityChange(valid);
    }
  }

  const showError =
    touched && value.length > 0 && !isValidPhoneNumber(value, defaultCountry);

  return (
    <div className={`grid gap-1 ${className}`}>
      {label ? (
        <label className="grid gap-1 text-xs font-medium text-slate-600" htmlFor={inputId}>
          {label}
          {required ? " *" : ""}
          <input
            id={inputId}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className={inputClassName}
            value={value}
            required={required}
            placeholder="+7 (___) ___-__-__"
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => setTouched(true)}
          />
        </label>
      ) : (
        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className={inputClassName}
          value={value}
          required={required}
          placeholder="+7 (___) ___-__-__"
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setTouched(true)}
        />
      )}
      {showError ? (
        <p className="text-xs text-amber-700">Проверьте формат: +7 (XXX) XXX-XX-XX</p>
      ) : null}
    </div>
  );
}

/**
 * Helper for code outside the component that needs to canonicalise a phone
 * before sending it to the backend (e.g., for AdminChangeLog parity).
 */
export function toE164(raw: string, defaultCountry: "RU" | "BY" | "KZ" | "UA" = "RU"): string | null {
  const parsed = parsePhoneNumberFromString(raw, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.format("E.164");
}
