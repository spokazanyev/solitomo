# Contract: Annotations API

**Spec**: [../spec.md](../spec.md) | **Requirements**: FR-160, FR-161, FR-162

## Назначение

CRUD для коллекции `Annotations`, используемой как таймлайн событий в недельных отчётах (deploys, кампании, инциденты).

**v1 scope**: ручной ввод через Payload Admin UI + опциональный программный POST. Авто-CI-hook — defer до v1.1 (FR-160).

## Через Payload Admin UI (основной путь в v1)

Стандартный CRUD на `/admin/collections/annotations`. Поля формы — см. data-model.md §2.1.

**Доступ**: admin role, как у других системных коллекций.

## REST endpoint (опциональный для CI/CD в v1.1)

### `POST /api/analytics/annotations`

**Auth**: `Authorization: Bearer <CRON_SECRET>` (как у других cron-эндпоинтов).

**Request body**:
```typescript
{
  type: 'deploy' | 'campaign' | 'incident' | 'manual',
  occurredAt?: string,         // ISO8601; default = now
  title: string,               // ≤120 chars
  description?: string,        // ≤2000 chars
  gitRef?: string,             // required if type=deploy
  prUrl?: string,
  environment?: 'production' | 'staging'   // default 'production'
}
```

**Validation**:
- `type=deploy` → `gitRef` обязателен (иначе 400).
- `type=incident` → `description` обязателен (иначе 400).
- `title.length ≤ 120`.
- `environment=staging` записывается, но **в weekly-report не попадает** (фильтрация в renderer'е).

**Response**:
- `201 Created`:
  ```typescript
  {
    id: string,                // Payload-ID
    occurredAt: string,
    createdAt: string
  }
  ```
- `400 Bad Request`: validation failure.
- `401 Unauthorized`: невалидный CRON_SECRET.

**Side effects**:
- Запись в коллекцию `annotations`.
- `createdBy` = system user (или anonymous-marker; не Payload-user, т.к. CI).

### `GET /api/analytics/annotations?from=<date>&to=<date>&type=<type>`

Используется weekly-report CLI (см. `weekly-report-cli.md`) для тащения аннотаций за неделю. Не доступен публично — только server-side через Payload Local API. Endpoint реализуется в admin-route (`/api/admin/...`) и закрыт RBAC.

## Триггер использования

**v1 (ручной)**:
1. Owner идёт в Payload Admin → Annotations → New.
2. Заполняет поля (например, перед запуском новой рекламной кампании: type=campaign, title="Запуск Яндекс.Директ — PDU rackmount", occurredAt=now).
3. Save.

**v1.1 (auto от CI)**: GitHub Action в `.github/workflows/deploy.yml` после успешного prod-deploy:
```yaml
- name: Annotate analytics
  run: |
    curl -X POST $SITE_URL/api/analytics/annotations \
      -H "Authorization: Bearer $CRON_SECRET" \
      -d '{"type":"deploy","title":"Deploy main","gitRef":"${{ github.sha }}","prUrl":"${{ github.event.pull_request.html_url }}","environment":"production"}'
```

## Используется в weekly-report

Weekly-report CLI вызывает Payload Local API:
```typescript
const annotations = await payload.find({
  collection: 'annotations',
  where: {
    occurredAt: { greater_than_equal: weekStart, less_than_equal: weekEnd },
    environment: { equals: 'production' }
  },
  sort: 'occurredAt'
})
```

Они отображаются в секции «Аннотации недели» MD-отчёта как таймлайн:
```markdown
## Аннотации недели

| Когда | Тип | Описание |
|---|---|---|
| Пн 09:00 | deploy | Deploy main @abc1234 ([PR #58](...)) |
| Ср 14:00 | campaign | Запуск Я.Директ — PDU rackmount |
| Чт 11:30 | incident | 5xx на /checkout 15 минут ([тикет](...)) |
```

## Тестируемость

**Unit test** (`apps/web/src/lib/annotations/tests/client.test.ts`):
- POST с валидным body → 201, документ создан.
- POST type=deploy без gitRef → 400.
- POST type=incident без description → 400.
- POST без CRON_SECRET → 401.
- GET с диапазоном дат → возвращает только аннотации в диапазоне.
- GET с фильтром environment=production → не возвращает staging-записи.
