"use client";

import { useEffect, useState } from "react";

interface Suggestion {
  value: string;
  unrestricted_value?: string;
  data?: Record<string, unknown>;
}

export interface AddressFormValue {
  query: string;
  postalCode?: string;
  city?: string;
  region?: string;
  street?: string;
  house?: string;
  flat?: string;
  kladrId?: string;
  fiasId?: string;
  isValid?: boolean;
}

export function AddressForm({
  value,
  onChange,
}: {
  value: AddressFormValue;
  onChange: (next: AddressFormValue) => void;
}) {
  const [query, setQuery] = useState(value.query ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);

  // Debounce + suggest
  useEffect(() => {
    if (query.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/shipping/validate-address?suggest=1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        setSuggestions(data.suggestions ?? []);
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function pick(sg: Suggestion) {
    const d = (sg.data ?? {}) as Record<string, string | undefined>;
    onChange({
      query: sg.value,
      postalCode: d.postal_code,
      city: d.city,
      region: d.region,
      street: d.street,
      house: d.house,
      flat: d.flat,
      kladrId: d.kladr_id,
      fiasId: d.fias_id,
      isValid: true,
    });
    setQuery(sg.value);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-700">
        Адрес доставки
        <input
          type="text"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            onChange({ ...value, query: next, isValid: false });
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Москва, ул. Тверская, 7"
        />
      </label>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {suggestions.map((sg) => (
            <li
              key={sg.value}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-sky-50"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(sg);
              }}
            >
              {sg.value}
            </li>
          ))}
        </ul>
      )}
      {value.isValid === false && query.length > 0 && (
        <p className="mt-1 text-xs text-amber-700">
          Адрес не подтверждён. Проверьте корректность.
        </p>
      )}
    </div>
  );
}
