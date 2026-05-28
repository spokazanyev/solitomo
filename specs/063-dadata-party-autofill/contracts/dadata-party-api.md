# Contract: POST /api/dadata/party

Серверный прокси к DaData `suggest/party`. Зеркалит [/api/dadata/fio](../../../apps/web/src/app/api/dadata/fio/route.ts).

- **Runtime**: `nodejs`; `dynamic = "force-dynamic"`.
- **Auth**: токен DaData читается server-side в `@/lib/dadata/client` (FR-011). Клиент токен не видит.

## Request

```http
POST /api/dadata/party
Content-Type: application/json
```

```ts
{
  query: string;   // название организации ИЛИ ИНН
  count?: number;  // по умолчанию 7; зажимается в [1..10]
}
```

## Response (200)

```ts
{
  suggestions: DadataPartySuggestion[]  // только branch_type === "MAIN" (R4)
}
```

- Пустой/короткий `query` → `{ suggestions: [] }` (200). Минимальная длина запроса (≥3) гейтится на клиенте (FR-002), но сервер тоже безопасно вернёт `[]`.
- DaData не сконфигурирован / ошибка / таймаут → `{ suggestions: [] }` (200) — мягкая деградация (FR-012). Никогда не 5xx из-за внешнего сбоя.
- Невалидный JSON в теле → `{ code: "INVALID_JSON" }` (400).

## Поведенческие требования

| Требование | Проверка |
|---|---|
| Токен не в браузере (FR-011) | В Network-вкладке запрос идёт на `/api/dadata/party`, не на `suggestions.dadata.ru`; заголовка `Authorization` в браузерном запросе нет. |
| Только головная (R4/Q5) | Записи `data.branch_type === "BRANCH"` отсутствуют в ответе. |
| `count` cap | `count: 999` в запросе → не более 10 результатов. |
| Деградация (FR-012) | При незаданном `DADATA_API_KEY` ответ `{ suggestions: [] }`, статус 200. |

## Клиентский слой (`@/lib/dadata/client`)

```ts
const SUGGEST_PARTY_URL =
  "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party";

async function suggestParty(query: string, count = 7): Promise<DadataPartySuggestion[]>;
// - query.trim().length < 1 → []
// - getClient(false) (Token-only, без X-Secret)
// - try/catch → [] при любой ошибке (зеркалит suggestFio)
// - фильтр branch_type !== "BRANCH" применяется здесь ИЛИ в route (R4)
```
