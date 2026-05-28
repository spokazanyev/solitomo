# Contract: `<CompanySuggestInput>`

Новый client-компонент `apps/web/src/components/checkout/CompanySuggestInput.tsx`. Единое поле подсказок организаций (FR-001). Переиспользует механику `DadataSuggestInput` (debounce, dropdown, blur-таймер, `onMouseDown`-pick), но рендерит двухстрочные строки и отдаёт структурированный результат.

## Props

```ts
interface CompanySuggestInputProps {
  value: string;                              // текст поля (название/ИНН)
  onQueryChange: (next: string) => void;      // ручной ввод в поле подсказок
  onSelect: (req: CompanyRequisites) => void; // выбор организации из списка
  label?: string;                             // напр. "Найти по названию или ИНН"
  required?: boolean;
  placeholder?: string;
}
```

`CompanyRequisites` — см. [data-model.md](../data-model.md) §2.

## Поведение

| # | Требование | Спека |
|---|---|---|
| 1 | Запрос подсказок только при `query.trim().length >= 3` | FR-002 |
| 2 | Debounce 300 мс перед fetch на `/api/dadata/party` | FR-002 |
| 3 | Каждая строка списка показывает **название + ИНН** (и адрес при наличии) для различения тёзок | FR-003 |
| 4 | Клик по строке → `onSelect(partyToRequisites(data))`, список закрывается | FR-004 |
| 5 | Пустой ответ / сеть упала → поле работает как обычный текст, ошибок не кидает | FR-010, FR-012 |
| 6 | Поле НЕ имеет `data-yandex-metrika-mask` (в отличие от ФИО/email) | FR-016 |
| 7 | Спецсимволы/кавычки в названии («ООО "Ромашка-С"») рендерятся и подставляются корректно | Edge Cases |
| 8 | Эмитит `company_suggest_shown` при отображении непустого списка | FR-015 |

## Контракт интеграции в `InvoiceCheckoutForm`

- Размещается в блоке «Реквизиты юрлица» над/вместо ручного поля «Наименование компании» (5 полей остаются видимыми и редактируемыми ниже — FR-005, FR-010).
- `onSelect(req)`:
  1. `setCompanyName(req.companyName); setInn(req.inn); setKpp(req.kpp); setOgrn(req.ogrn); setLegalAddress(req.legalAddress);` (безусловно — overwrite-on-reselect, R8/Q2).
  2. `setCompanyStatus(req.status); innValidationFiredRef.current = null;`
  3. `trackCompanySelected({ formType: "checkout_legal", hasKpp: !!req.kpp, hasLegalAddress: !!req.legalAddress });`
  4. если `req.isRisky` → показать warning + `trackCompanyStatusWarning({ formType: "checkout_legal", status: req.status });`
- Поля `companyName/inn/kpp/ogrn/legalAddress` остаются обычными контролируемыми инпутами с ручным редактированием (FR-005).

## Warning-UI (FR-009)

Если `companyStatus ∈ {LIQUIDATING, LIQUIDATED, BANKRUPT}` — заметный блок рядом с реквизитами (роль `alert`, янтарный/красный), текст по статусу (напр. «Организация ликвидирована», «В процессе банкротства»). Кнопка «Выписать счёт» остаётся активной (не блокирует — FR-009/SC-005).
