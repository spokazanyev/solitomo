# Contract: 152-ФЗ DSAR Runbook (Аналитические данные)

**Spec**: [../spec.md](../spec.md) | **Requirements**: FR-350, FR-351, FR-352

**Артефакт**: `06-reports/analytics/dsar-runbook.md` (создаётся на этапе implementation как deliverable v1).

Этот файл — контракт того, что должен содержать runbook. Сам runbook (с реальными командами и API-вызовами) пишется в `06-reports/analytics/dsar-runbook.md` и обновляется при изменениях DSAR-процесса.

---

## Цель runbook

Описать пошаговую процедуру для администратора, как ответить на:
1. **Access request** — «Какие аналитические данные обо мне у вас есть?»
2. **Delete request** — «Удалите мои аналитические данные».

Срок выполнения по 152-ФЗ: **30 дней** с момента подтверждённого запроса.

## Структура runbook (что должно быть в `dsar-runbook.md`)

### Раздел 1: Получение и верификация запроса

Содержит:
- Канал получения (email на `privacy@<domain>` или форма на `/contacts`).
- Verification steps: подтверждение, что запрашивающий — это владелец данных (email confirmation, или для авторизованных Customer — через magic-link).
- Шаблоны ответных писем (acknowledgement + final response).

### Раздел 2: Идентификация субъекта

Содержит шаги:
1. Поиск Customer по email (Payload Admin → Customers → filter by email).
2. Извлечение `customer.ymClientId` — это идентификатор пользователя в Метрике.
3. Если Customer не найден (анонимный запрос) — попросить запрашивающего предоставить cookie `_ym_uid` через инструкции «открой DevTools → Application → Cookies → найди `_ym_uid`».

### Раздел 3: Извлечение данных (для access request)

Содержит конкретные API-вызовы:
1. **Метрика — визиты пользователя**:
   ```
   GET https://api-metrika.yandex.net/management/v1/counter/<id>/logrequest
   ?source=visits
   &fields=ym:s:visitID,ym:s:visitDuration,ym:s:bounce,ym:s:UTMSource,ym:s:UTMCampaign
   &date1=2026-05-01&date2=<today>
   ```
   с фильтром по `ym:s:userIDHash=<hash of ymClientId>`.
2. **Метрика — события (goals reached)**: аналогичный API с фильтром по `ym:s:lastTrafficSource`.
3. **Payload — записи Customer/Order/Cart**:
   - Customer record (полностью).
   - Все Orders с этим customer.
   - Все Carts с этим customer (через ymClientId или customer_id).
4. **Payload — Annotations** не содержат ПДн, не входят в DSAR.

Формат ответа:
- JSON-attachment в email с разбивкой по разделам.
- Краткая декларация на русском «какие данные хранятся, для каких целей, на каком основании».

### Раздел 4: Удаление (для delete request)

Содержит шаги:
1. **Метрика — удаление визитов**:
   ```
   POST https://api-metrika.yandex.net/management/v1/counter/<id>/logrequests/<request_id>/clean
   ```
   (Yandex Метрика поддерживает удаление по visitID; runbook содержит конкретный workflow.)
2. **Payload — soft-delete с retention**:
   - Customer: `customer.deletedAt = now; customer.dsarLog.push({...})`.
   - Orders: остаются (бухгалтерская обязанность 5 лет), но `order.attributionFirstTouch = null`, `order.ymClientId = null` (обезличены).
   - Carts: hard-delete (нет регуляторной обязанности хранить).
3. **Server-side Cookie очистка**: для авторизованных Customer — на следующем визите set-cookie со значениями `expires=0`.
4. **Логирование**: `customer.dsarLog.push({ type: 'delete', requestedAt, completedAt, completedBy })`.

### Раздел 5: Edge-кейсы

- **Заказ в активном цикле возврата** — удаление откладывается до завершения возврата + 30 дней.
- **Заказ в незавершённой оплате** — то же.
- **Анонимный запрос без `_ym_uid`** — невозможно идентифицировать; вежливый отказ с разъяснением.
- **Webvisor-записи с PII масками** — Метрика отдельным запросом, runbook содержит шаги.

### Раздел 6: Учёт DSAR

Каждый DSAR-запрос фиксируется в `customer.dsarLog`:
```typescript
{
  requestedAt: Date,
  type: 'access' | 'delete',
  status: 'pending' | 'completed' | 'rejected',
  completedAt?: Date,
  completedBy?: User,
  notes?: string
}
```

Анонимные DSAR (без Customer) — в отдельной таблице `AdminChangeLog` с маркером `dsar_anonymous`.

### Раздел 7: SLA и метрики

- **Целевое время выполнения**: <8 рабочих часов от подтверждённого запроса.
- **152-ФЗ дедлайн**: 30 календарных дней; нарушение — основание для штрафа Роскомнадзора.
- **Эскалация**: если admin не справляется за 24 часа — escalation в DPO (Data Protection Officer; в v1 = единственный admin = svp).

## Acceptance Criteria для runbook

- Описаны все шаги выше с конкретными командами.
- Указаны точные URL и параметры API.
- Указано, где взять токен Метрика API (env var `YM_API_TOKEN`).
- Шаблоны ответных писем приведены полностью.
- Edge-кейсы покрыты.
- Runbook **проверен** на тестовом DSAR (см. SC-030: «admin выполняет шаги <30 минут»).

## Validation в smoke-test

В v1 smoke-тест **не** автоматизирует DSAR (он редкий и требует ручных действий). Но проверяется:
- Файл `06-reports/analytics/dsar-runbook.md` существует (FR-350).
- Поле `Customer.dsarLog` существует в schema (через TS типы).
