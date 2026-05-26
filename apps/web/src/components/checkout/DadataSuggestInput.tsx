"use client";

import { useEffect, useId, useRef, useState } from "react";

interface Suggestion {
  value: string;
  data?: Record<string, unknown>;
}

// Minimal email shape check used both to gate the suggest call (DaData returns
// noise for queries without "@" — see /api/dadata/email response for "svp" or
// "svpredbc.ru") and to drive the live validity hint.
const EMAIL_LIKE = /.+@.+\..+/;

interface BaseProps {
  value: string;
  onChange: (next: string, data?: Record<string, unknown>) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** HTML autocomplete attribute (e.g., "name", "email"). */
  autoComplete?: string;
  /** HTML5 type. Defaults to "text". For email use "email". */
  type?: "text" | "email";
}

interface FioProps extends BaseProps {
  kind: "fio";
  parts?: Array<"NAME" | "PATRONYMIC" | "SURNAME">;
}
interface EmailProps extends BaseProps {
  kind: "email";
}

type Props = FioProps | EmailProps;

/**
 * Reusable DaData suggest-input. Backed by /api/dadata/fio or /api/dadata/email.
 * When DaData isn't configured server-side, both endpoints return an empty
 * `suggestions` array — the input degrades gracefully to a plain text field.
 *
 * Behaviour:
 *  - Debounce 300 ms before fetching suggestions.
 *  - Dropdown opens on focus when suggestions are present.
 *  - `onMouseDown` (instead of onClick) so dropdown picks land before blur.
 *  - On pick, `onChange` is called with the canonical value + the raw `data`
 *    object (parents that care about structured fields — surname / name /
 *    patronymic / gender for FIO — can consume it).
 */
export function DadataSuggestInput(props: Props) {
  const {
    value,
    onChange,
    label,
    required,
    placeholder,
    className = "",
    inputClassName: inputClassNameFromProps,
    autoComplete,
    type = "text",
  } = props;

  const inputId = useId();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const blurTimer = useRef<number | null>(null);

  // Live invalidity hint — only shown after the field has been blurred at least
  // once, so we don't yell at users while they're still typing.
  const showEmailHint =
    props.kind === "email" && touched && value.length > 0 && !EMAIL_LIKE.test(value);

  // Border colour reflects validity so the field itself signals an issue,
  // not just the hint line below it.
  const inputClassName =
    inputClassNameFromProps ??
    `rounded-md border ${
      showEmailHint
        ? "border-rose-500 focus:border-rose-500"
        : "border-slate-300 focus:border-sky-600"
    } px-3 py-2 text-sm text-slate-800 focus:outline-none`;

  useEffect(() => {
    if (!value || value.trim().length < 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }
    // For email, skip the suggest call until there's an "@" — DaData returns
    // unhelpful local-part-only matches otherwise (e.g. "svpredbc.ru" gets
    // suggestions "svpredbc.rus / svpredbc.ruslan / svpredbc.russia").
    if (props.kind === "email" && !value.includes("@")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const endpoint = props.kind === "fio" ? "/api/dadata/fio" : "/api/dadata/email";
        const body: Record<string, unknown> = { query: value };
        if (props.kind === "fio" && props.parts) {
          body.parts = props.parts;
        }
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        setSuggestions(data.suggestions ?? []);
      } catch {
        // network / abort — silently keep stale or empty list
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [value, props]);

  function pick(sg: Suggestion) {
    onChange(sg.value, sg.data);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`}>
      {label ? (
        <label className="grid gap-1 text-xs font-medium text-slate-600" htmlFor={inputId}>
          {label}
          {required ? " *" : ""}
          <input
            id={inputId}
            type={type}
            className={inputClassName}
            value={value}
            required={required}
            placeholder={placeholder}
            autoComplete={autoComplete}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              if (blurTimer.current !== null) {
                window.clearTimeout(blurTimer.current);
                blurTimer.current = null;
              }
              setOpen(true);
            }}
            onBlur={() => {
              // Delay closing so a click on a suggestion (mousedown→blur→click)
              // can fire before the dropdown disappears.
              blurTimer.current = window.setTimeout(() => setOpen(false), 150);
              setTouched(true);
            }}
          />
        </label>
      ) : (
        <input
          id={inputId}
          type={type}
          className={inputClassName}
          value={value}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setOpen(false), 150);
            setTouched(true);
          }}
        />
      )}
      {open && suggestions.length > 0 ? (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white text-sm shadow-lg"
        >
          {suggestions.map((sg) => (
            <li
              key={sg.value}
              role="option"
              aria-selected={value === sg.value}
              className="cursor-pointer px-3 py-2 hover:bg-sky-50"
              // Use onMouseDown so the click fires before the input's onBlur,
              // which would otherwise close the dropdown first.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(sg);
              }}
            >
              {sg.value}
            </li>
          ))}
        </ul>
      ) : null}
      {showEmailHint ? (
        <p
          role="alert"
          className="mt-1 flex items-center gap-1.5 text-xs font-medium text-rose-700"
        >
          <span aria-hidden="true">⚠</span>
          Похоже, не email — нужен формат <code className="font-mono">имя@домен.ру</code>
        </p>
      ) : null}
    </div>
  );
}
