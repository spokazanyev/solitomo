# Research: DaData Party Autofill (063)

Phase 0 — решения по техническим вопросам. NEEDS CLARIFICATION из спеки сняты в `/clarify` (5 вопросов); ниже — реализационные решения.

## R1 — DaData endpoint и тариф

**Decision**: Использовать `POST https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party` с заголовком `Authorization: Token <apiKey>` (без `X-Secret`).

**Rationale**: Подсказки организаций (`suggest/party`) входят в бесплатный тариф «Подсказки» — тот же, что уже используется для `suggest/fio` и `suggest/email` ([client.ts:34-35](../../apps/web/src/lib/dadata/client.ts)). Существующий `getClient(false)` (useSecret=false) уже формирует нужные заголовки. Секрет (`X-Secret`) нужен только для `clean`-эндпоинтов — для party не требуется.

**Alternatives considered**:
- `findById/party` (поиск строго по ИНН) — отвергнут: не покрывает поиск по названию; единое поле (FR-001) требует suggest, который принимает и название, и ИНН в `query`.
- Отдельный новый провайдер — отвергнут (Assumption спеки: тот же провайдер и прокси-паттерн).

## R2 — Серверный прокси (FR-011)

**Decision**: Новый route `apps/web/src/app/api/dadata/party/route.ts`, зеркало [fio/route.ts](../../apps/web/src/app/api/dadata/fio/route.ts): `runtime="nodejs"`, `dynamic="force-dynamic"`, body `{ query, count? }`, `count` зажат в [1..10], пустой query → `{ suggestions: [] }`. Токен читается на сервере в `@/lib/dadata/client`.

**Rationale**: Полностью повторяет существующий безопасный паттерн; токен не попадает в браузер. При несконфигурированном DaData `suggestParty` вернёт `[]` (как fio/email) — мягкая деградация (FR-012).

**Alternatives considered**: прямой клиентский вызов DaData — отвергнут (FR-011: токен не должен утекать).

## R3 — Контрольная сумма ИНН (FR-007/FR-008)

**Decision**: Чистая функция `isValidInn(inn: string): boolean` в `apps/web/src/lib/dadata/inn.ts`. Проверка ТОЛЬКО при длине 10 или 12 (иначе `false`, но UI не показывает ошибку до достижения 10/12 — FR-008). Алгоритм:

- **10 знаков (юрлицо)**: веса `[2,4,10,3,5,9,4,6,8]` по первым 9 цифрам; `(Σ wᵢ·dᵢ) mod 11 mod 10` == `d[9]`.
- **12 знаков (ИП/физлицо)**: две контрольные цифры.
  - n11: веса `[7,2,4,10,3,5,9,4,6,8]` по первым 10 цифрам; `mod 11 mod 10` == `d[10]`.
  - n12: веса `[3,7,2,4,10,3,5,9,4,6,8]` по первым 11 цифрам; `mod 11 mod 10` == `d[11]`.

**Rationale**: Канонический алгоритм ФНС; полностью локальный (не тратит лимит DaData), детерминированный, легко тестируется. В кодовой базе своего util нет (grep подтвердил) — заводим в `lib/dadata` рядом с провайдером.

**Alternatives considered**: валидация только через DaData статус — отвергнута (нужна блокировка при ручном вводе без подсказки, FR-007; и не нагружать внешний сервис на каждое нажатие).

## R4 — Только головная организация, без филиалов (FR-004, Q5)

**Decision**: Фильтровать ответ server-side, оставляя записи где `data.branch_type === "MAIN"` (либо отсутствует). Филиалы (`branch_type === "BRANCH"`) исключаются из списка подсказок.

**Rationale**: Решение клиента из `/clarify` (Q5: «только головная»). DaData возвращает филиалы отдельными suggestion при поиске по точному ИНН; `branch_type` присутствует в `data`. Фильтр на сервере проще и не зависит от UI. КПП филиала при необходимости правится вручную (FR-004).

**Alternatives considered**: query-фильтр DaData — отвергнут: `suggest/party` не поддерживает `branch_type` как входной фильтр стабильно; надёжнее фильтровать результат.

## R5 — Нормализация party → реквизиты + статус (FR-004, FR-006, FR-009)

**Decision**: Функция `partyToRequisites(data)` в `party-normalize.ts` маппит:
- `companyName` ← `data.name.short_with_opf` (fallback `name.full_with_opf`).
- `inn` ← `data.inn`; `kpp` ← `data.kpp` (пусто у ИП — FR-006); `ogrn` ← `data.ogrn`.
- `legalAddress` ← `data.address.unrestricted_value` (fallback `address.value`).
- `status` ← `data.state.status` (`ACTIVE|LIQUIDATING|LIQUIDATED|BANKRUPT|REORGANIZING`).
- `isRisky` ← `status ∈ {LIQUIDATING, LIQUIDATED, BANKRUPT}` (Q3/FR-009).

Отсутствующие поля → пустая строка, без ошибок (FR-006).

**Rationale**: Изолирует форму чекаута от формата DaData (Constitution IV/VI). Возвращает плоский объект под 5 setters + флаг риска для warning-UI.

## R6 — Аналитические события (FR-015, full set из Q1)

**Decision**: 3 новых события через `trackAnalyticsEvent` в [events.ts](../../apps/web/src/lib/analytics/events.ts):
- `company_suggest_shown` — `{ form_type, results_count }` (показ списка).
- `company_selected` — `{ form_type, has_kpp, has_legal_address }` (выбор / автозаполнение 5 полей).
- `company_status_warning` — `{ form_type, status }` (показ предупреждения).

Payload НЕ содержит сырых ИНН/наименования — только счётчики/флаги/статус. Это достаточно для SC-001 (`company_selected`) и SC-003 (тайминг между `company_suggest_shown` и `company_selected`), и проходит глобальный `scrubPII` в `trackAnalyticsEvent` без сюрпризов.

**Rationale**: Хотя FR-016 разрешает не маскировать поле, нести ИНН/название в событиях нет необходимости — измеримость SC обеспечивается метаданными. Меньше риска и чище аналитика.

**Alternatives considered**: одно событие на выбор — отвергнуто (Q1: «полный набор» нужен для SC-003 тайминга и SC-005 предупреждения).

## R7 — Компонент: новый `CompanySuggestInput` vs расширение `DadataSuggestInput`

**Decision**: Новый компонент `CompanySuggestInput.tsx`, переиспользующий паттерн (debounce 300 мс, dropdown, `onMouseDown`-pick, blur-таймер) из `DadataSuggestInput`, но с двухстрочными строками (название + ИНН/адрес для различения тёзок — FR-003) и колбэком `onSelect(party)`, отдающим структурированный объект под 5 setters.

**Rationale**: `DadataSuggestInput` — дискриминированный union (`fio|email`), его `pick` отдаёт `onChange(value, data)` и рендерит однострочные строки. Party требует другой рендер строки и маппинг в 5 полей — расширять общий компонент дороже в поддержке (Constitution VI). Логика идентична по механике, отличается рендером результата.

**Alternatives considered**: добавить `kind:"party"` в `DadataSuggestInput` — отвергнуто: усложняет общий компонент party-специфичным рендером и union-ветвлением.

## R8 — Overwrite-on-reselect (FR-005, Q2)

**Decision**: `onSelect(party)` в форме безусловно вызывает все 5 setters + перезапускает innValidation-ref (сброс `innValidationFiredRef`). Ручной ввод в поля при этом не блокируется. Новый явный выбор перезаписывает всё (last explicit pick wins).

**Rationale**: Решение Q2. Перезапись контрольной суммы при смене ИНН покрывает edge-case «перевыбор после ручной правки».

## Summary of decisions

| # | Вопрос | Решение |
|---|---|---|
| R1 | Endpoint/тариф | `suggest/party`, Token-only, бесплатный тариф |
| R2 | Прокси | новый `/api/dadata/party`, зеркало fio-route |
| R3 | INN checksum | локальный `isValidInn`, 10/12, алгоритм ФНС |
| R4 | Филиалы | только `branch_type==="MAIN"` (server-side фильтр) |
| R5 | Нормализация | `partyToRequisites` → 5 полей + status + isRisky |
| R6 | События | 3 события, без сырых PII в payload |
| R7 | Компонент | новый `CompanySuggestInput` |
| R8 | Reselect | безусловная перезапись 5 полей |

Все NEEDS CLARIFICATION сняты. Готово к Phase 1.
