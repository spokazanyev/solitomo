# DSAR Runbook — Аналитические данные (152-ФЗ)

**Спека**: 058, T076, FR-350-352
**Дата**: 2026-05-26
**Контракт**: `specs/058-behavior-and-ad-analytics/contracts/dsar-runbook.md`

Этот документ описывает процедуру ответа на запросы пользователей по 152-ФЗ
относительно аналитических данных (Yandex.Metrika + Payload customer/order
records). Срок выполнения: **30 календарных дней** с даты подтверждённого
запроса.

---

## Раздел 1: Получение и верификация запроса

### Канал
- Email: `privacy@pdumarket.ru` (или site `/info/privacy/` форма)
- Подтверждение personality:
  - Если запрос от Customer-аккаунта → magic-link verification (auto)
  - Если анонимный → попросить предоставить `_ym_uid` cookie value (см.
    Раздел 2)

### Шаблон подтверждения

```
Здравствуйте, <имя>.

Получили ваш запрос от <date> о <access|удалении> ваших аналитических
данных согласно ФЗ-152.

В соответствии со ст. 14 (доступ) / ст. 21 (удаление) мы выполним запрос
в течение 30 дней. Контактируем при выполнении.

Если у вас есть вопросы — ответьте на это письмо.

С уважением, команда Soliton.
```

---

## Раздел 2: Идентификация субъекта

### Сценарий A: Авторизованный Customer

1. Открыть Payload Admin → Customers
2. Фильтр по `email` запрашивающего
3. Записать `customer.id` (UUID) и `customer.ymClientId`

### Сценарий B: Анонимный посетитель

Попросить пользователя через ответный email:

```
Здравствуйте.

Для идентификации ваших аналитических данных, пожалуйста, выполните в
браузере (где вы посещали наш сайт):

1. Откройте сайт pdumarket.ru
2. Откройте DevTools (F12 → Application → Cookies)
3. Найдите cookie с именем `_ym_uid` — это ваш аналитический ID
4. Отправьте нам это значение

Без этого ID мы не можем найти конкретно ваши данные в системе
анонимной аналитики (это особенность 152-ФЗ-совместимой системы:
мы не храним email/телефон в Метрике).
```

---

## Раздел 3: Извлечение данных (access request)

### Из Yandex.Metrika

Получить токен: `YM_AGENT_TOKEN` (env-var production-сервера).

```bash
# Все визиты по ymClientId (последние 90 дней — Metrika API max диапазон)
curl -X POST \
  -H "Authorization: OAuth $YM_AGENT_TOKEN" \
  "https://api-metrika.yandex.net/management/v1/counter/109422539/logrequests" \
  -d '{
    "date1": "2026-02-26",
    "date2": "2026-05-26",
    "fields": "ym:s:visitID,ym:s:visitDuration,ym:s:bounce,ym:s:UTMSource,ym:s:UTMCampaign,ym:s:lastTrafficSource,ym:s:counterUserIDHash",
    "source": "visits"
  }'
# Returns request_id
```

Затем получить результат:
```bash
curl -H "Authorization: OAuth $YM_AGENT_TOKEN" \
  "https://api-metrika.yandex.net/management/v1/counter/109422539/logrequest/<request_id>"
# Filter по counterUserIDHash = hash(ymClientId)
```

### Из Payload (Customer-related)

```sql
-- Customer record (полностью)
SELECT * FROM customers WHERE id = '<customer-id>';

-- Все Orders с этим customer
SELECT id, client_number, status, paid_at, total, attribution_first_touch_*
FROM orders
WHERE customer = '<customer-id>';

-- Все Carts (active + abandoned)
SELECT id, cart_token, status, attribution_first_touch_*, ym_client_id
FROM carts
WHERE customer = '<customer-id>' OR ym_client_id = '<ym_client_id>';

-- AgentExecutionLog (если customer был subject)
-- В v1 — пустое; в v1.1 это audit-log агентских вызовов, обычно НЕ содержит
-- customer-specific данных.
```

### Формирование ответа

JSON-attachment в email-ответ:

```json
{
  "analytics_data_export": {
    "requested_at": "2026-XX-XX",
    "customer_id": "<UUID>",
    "ym_client_id": "<hash>",
    "metrika_visits": [...],
    "payload_customer_record": {...},
    "payload_orders": [...],
    "payload_carts": [...],
    "policy_versions_accepted": [...]
  }
}
```

Сопроводительная декларация (русский):

> Согласно ст. 14 ФЗ-152 предоставляем выгрузку ваших персональных данных,
> обработанных нашей аналитической системой за последние 90 дней:
> - визиты с привязкой к вашему cookie _ym_uid в Яндекс.Метрике;
> - записи Customer/Orders/Carts в нашей БД с привязкой к вашему аккаунту.
>
> Цели обработки: измерение поведения и эффективности рекламы; основание —
> ваше согласие через cookie-banner (см. /info/privacy/).
>
> Срок хранения — 25 месяцев для Метрики, 5 лет для бухгалтерских данных
> (НК РФ).

---

## Раздел 4: Удаление (delete request)

### Шаг 1. Yandex.Metrika удаление визитов

```bash
# Удаление визитов из Metrika по userIDHash
curl -X POST \
  -H "Authorization: OAuth $YM_AGENT_TOKEN" \
  "https://api-metrika.yandex.net/management/v1/counter/109422539/userid_for_hash_delete" \
  -d '{"hash": "<ym_client_id_hashed>"}'
```

⚠️ **ВАЖНО**: Metrika удалит данные асинхронно (до 30 дней). Получите
confirmation_request_id и проверяйте status.

### Шаг 2. Payload soft-delete + обезличивание

```typescript
// Customer — soft-delete с обезличиванием
await payload.update({
  collection: "customers",
  id: customerId,
  data: {
    email: `deleted-${customerId}@anonymized.local`,
    firstName: "[DELETED]",
    lastName: "[DELETED]",
    phone: null,
    ymClientId: null,
    deletedAt: new Date().toISOString(),
    dsarLog: [
      ...existing.dsarLog,
      {
        requestedAt: requestDate,
        type: "delete",
        status: "completed",
        completedAt: new Date().toISOString(),
        completedBy: adminUserId,
      },
    ],
  },
});

// Orders — НЕ удаляем (5-летнее бухгалтерское обязательство), но обезличиваем
// аналитические поля
await payload.update({
  collection: "orders",
  where: { customer: { equals: customerId } },
  data: {
    attributionFirstTouch: {},
    ymClientId: null,
  },
});

// Carts — hard-delete (нет регуляторной обязанности)
await payload.delete({
  collection: "carts",
  where: { customer: { equals: customerId } },
});
```

### Шаг 3. Cookie cleanup

При следующем визите customer'а с тем же cookie → set-cookie с `expires=0`.
Реализация: добавить в `/api/customers/delete` endpoint set-cookie headers
для `_ym_uid`, `_solitomo_attribution`, `_solitomo_first_seen`.

### Шаг 4. Лог

Запись в `Customer.dsarLog` (см. Шаг 2). Дублирование в
`AdminChangeLog` (стандартный audit).

---

## Раздел 5: Edge-кейсы

| Сценарий | Действие |
|---|---|
| Заказ в активном return-cycle | Отложить удаление до завершения + 30 дней |
| Заказ в незавершённой оплате (pending) | Отложить до status=paid OR expired |
| Анонимный запрос без _ym_uid | Вежливый отказ с разъяснением |
| Customer запрашивает delete но Orders >5 лет нет | Можно hard-delete Customer полностью |
| Customer передумал после delete (within 30 дней) | Восстановление невозможно (Metrika unrecoverable) |

---

## Раздел 6: Учёт DSAR

Каждый запрос — запись в `Customer.dsarLog`:

```typescript
{
  requestedAt: Date,
  type: "access" | "delete",
  status: "pending" | "completed" | "rejected",
  completedAt?: Date,
  completedBy?: User-id,
  notes?: string,
}
```

Анонимные запросы → `AdminChangeLog` с `actorType: "system"` и
`targetCollection: "dsar_anonymous"`.

---

## Раздел 7: SLA и метрики

- **Целевое время выполнения**: < 8 рабочих часов от подтверждённого запроса
- **152-ФЗ дедлайн**: 30 календарных дней; нарушение — штраф Роскомнадзора
- **Эскалация**: > 24 часа → email спам admin@pdumarket.ru
- **Аудит**: ежегодная проверка `dsarLog` outliers (> 7 дней open)

---

## Acceptance Criteria

- [x] Документ написан (T076 в tasks.md)
- [x] API-команды конкретны (счётчик 109422539, env-var YM_AGENT_TOKEN)
- [x] Шаблоны ответных писем приведены
- [x] Edge-кейсы покрыты
- [ ] Manual rehearsal: admin выполнил тестовый DSAR < 30 минут (SC-030 в spec)
