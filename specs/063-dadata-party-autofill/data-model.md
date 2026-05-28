# Data Model: DaData Party Autofill (063)

Фича не меняет схему БД. Сущности ниже — это **транзиентные типы** (DTO/view-model), живущие в памяти на запрос подсказки и при заполнении формы. Хранение реквизитов в Orders уже существует.

## 1. DadataPartySuggestion (внешний формат DaData)

Сырой ответ `suggest/party` (частичный, только используемые поля).

```ts
interface DadataPartyData {
  inn?: string;
  kpp?: string;
  ogrn?: string;
  hid?: string;
  type?: "LEGAL" | "INDIVIDUAL";
  branch_type?: "MAIN" | "BRANCH";
  branch_count?: number;
  name?: {
    full_with_opf?: string;
    short_with_opf?: string;
    full?: string;
    short?: string;
  };
  address?: {
    value?: string;
    unrestricted_value?: string;
  };
  state?: {
    status?: "ACTIVE" | "LIQUIDATING" | "LIQUIDATED" | "BANKRUPT" | "REORGANIZING";
    actuality_date?: number;
  };
}

interface DadataPartySuggestion {
  value: string;            // краткое наименование с ОПФ
  unrestricted_value?: string;
  data: DadataPartyData;
}
```

Источник: DaData Suggestions API 4_1. Описывается в `@/lib/dadata/client`.

## 2. CompanyRequisites (нормализованный результат → форма)

Плоский объект, возвращаемый `partyToRequisites(data)` и потребляемый `InvoiceCheckoutForm`.

| Поле | Тип | Источник DaData | Заметки |
|---|---|---|---|
| `companyName` | `string` | `name.short_with_opf` ?? `name.full_with_opf` ?? `value` | Заполняет поле «Наименование компании» |
| `inn` | `string` | `data.inn` | 10 (юрлицо) / 12 (ИП) знаков |
| `kpp` | `string` | `data.kpp` ?? `""` | Пусто у ИП — FR-006 |
| `ogrn` | `string` | `data.ogrn` ?? `""` | Может отсутствовать |
| `legalAddress` | `string` | `address.unrestricted_value` ?? `address.value` ?? `""` | Юридический адрес |
| `status` | enum | `state.status` | `ACTIVE\|LIQUIDATING\|LIQUIDATED\|BANKRUPT\|REORGANIZING` |
| `isRisky` | `boolean` | derived | `status ∈ {LIQUIDATING, LIQUIDATED, BANKRUPT}` (FR-009/Q3) |

**Правила валидации/инвариантов:**
- Все строковые поля по умолчанию `""` (никогда `undefined`) → безопасное прямое присваивание в `value` инпутов (FR-006).
- `isRisky` вычисляется один раз при выборе; `REORGANIZING` и `ACTIVE` → `false` (Q3).
- Нормализация применяется только к записям `branch_type === "MAIN"` (фильтр на этапе прокси/клиента — R4).

## 3. Связь с существующей сущностью Order (без изменений)

`POST /api/orders` уже принимает `customer.{companyName, inn, kpp, ogrn, legalAddress}` ([InvoiceCheckoutForm.tsx:265-274](../../apps/web/src/components/cart/InvoiceCheckoutForm.tsx)). Фича только проставляет значения этих полей до отправки. **Миграции БД нет.**

## 4. Состояние формы (расширение existing useState)

`InvoiceCheckoutForm` уже держит `companyName/inn/kpp/ogrn/legalAddress`. Добавляется:

| State | Тип | Назначение |
|---|---|---|
| `companyStatus` | `CompanyRequisites["status"] \| null` | Для warning-UI; `null` пока организация не выбрана / выбрана вручную |
| (производное) `innChecksumValid` | `boolean` | `isValidInn(inn)` — гейт отправки (FR-007) |

**Переходы:**
- Выбор подсказки → перезапись 5 полей + `companyStatus` + сброс `innValidationFiredRef` (R8/Q2).
- Ручная правка ИНН → пересчёт `innChecksumValid`; `companyStatus` НЕ меняется (статус относится к последней выбранной организации; ручная правка реквизитов не сбрасывает предупреждение — оно остаётся информативным до нового выбора).
- Очистка поля подсказок → ранее заполненные значения сохраняются (FR-010 / US3 AC3).

## 5. Гейт готовности отправки (расширение `baseLegalReady`)

Текущий гейт: `/^[0-9]{10,12}$/.test(inn)`. **Заменяется** на `isValidInn(inn.trim())` (длина + контрольная сумма, FR-007). Остальные условия (`companyName`, `fullName`, `email`, `phoneOk`, `consent`, `modeReady`) без изменений.
