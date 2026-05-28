"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { DadataPartySuggestion } from "@/lib/dadata/client";
import { partyToRequisites, type CompanyRequisites } from "@/lib/dadata/party-normalize";
import { trackCompanySuggestShown } from "@/lib/analytics/events";

interface CompanySuggestInputProps {
  value: string;
  onQueryChange: (next: string) => void;
  onSelect: (req: CompanyRequisites) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  /** Analytics form-type tag. Defaults to the legal checkout. */
  formType?: string;
}

/**
 * 063: единое поле подсказок организаций (DaData `suggest/party`, FR-001).
 * Принимает название ИЛИ ИНН. Переиспользует механику DadataSuggestInput
 * (debounce, dropdown, onMouseDown-pick, blur-таймер), но рендерит двухстрочные
 * строки (название + ИНН/адрес — FR-003) и отдаёт структурированные реквизиты.
 *
 * НЕ маскируется для Метрики (FR-016): наименование/ИНН — публичные данные ЕГРЮЛ.
 * При пустом ответе / сбое сервиса работает как обычное текстовое поле (FR-010/FR-012).
 */
export function CompanySuggestInput({
  value,
  onQueryChange,
  onSelect,
  label,
  required,
  placeholder,
  formType = "checkout_legal",
}: CompanySuggestInputProps) {
  const inputId = useId();
  const [suggestions, setSuggestions] = useState<DadataPartySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number | null>(null);
  // Чтобы company_suggest_shown не дублировался на каждый дебаунс-фетч одного и
  // того же запроса — фиксируем последний запрос, по которому событие отправлено.
  const shownForQuery = useRef<string | null>(null);
  // После выбора организации родитель пишет её название в `value`. Подавляем
  // следующий fetch по этому значению, иначе уйдёт лишний запрос к DaData
  // (расход лимита) и спур-событие company_suggest_shown (R6/лимит-ассампшн).
  const suppressNextRef = useRef<string | null>(null);

  useEffect(() => {
    const q = value.trim();
    if (suppressNextRef.current !== null && q === suppressNextRef.current.trim()) {
      suppressNextRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }
    if (q.length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }
    // AbortController гасит уже улетевший fetch при смене запроса/размонтировании,
    // иначе медленный ответ по старому запросу мог бы перетереть свежие подсказки.
    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/dadata/party", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: DadataPartySuggestion[] };
        if (controller.signal.aborted) return;
        const next = data.suggestions ?? [];
        setSuggestions(next);
        if (next.length > 0 && shownForQuery.current !== q) {
          shownForQuery.current = q;
          trackCompanySuggestShown({ formType, resultsCount: next.length });
        }
      } catch {
        // сеть/abort — деградация до обычного поля, ошибок не показываем
      }
    }, 300);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [value, formType]);

  function pick(sg: DadataPartySuggestion) {
    const req = partyToRequisites(sg.data);
    // Родитель выставит value === req.companyName — гасим повторный fetch по нему.
    suppressNextRef.current = req.companyName;
    onSelect(req);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <label className="grid gap-1 text-xs font-medium text-slate-600" htmlFor={inputId}>
        {label}
        {required ? " *" : ""}
        <input
          id={inputId}
          type="text"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
          value={value}
          required={required}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            onQueryChange(e.target.value);
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
            blurTimer.current = window.setTimeout(() => setOpen(false), 150);
          }}
        />
      </label>
      {open && suggestions.length > 0 ? (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white text-sm shadow-lg"
        >
          {suggestions.map((sg) => {
            const inn = sg.data.inn ?? "";
            const addr = sg.data.address?.value ?? "";
            return (
              <li
                key={`${sg.data.hid ?? inn}-${sg.value}`}
                role="option"
                aria-selected={false}
                className="cursor-pointer px-3 py-2 hover:bg-sky-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(sg);
                }}
              >
                <span className="block text-slate-800">{sg.value}</span>
                <span className="block text-xs text-slate-500">
                  {inn ? `ИНН ${inn}` : ""}
                  {inn && addr ? " · " : ""}
                  {addr}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
