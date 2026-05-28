# Quickstart — Shipping Package Dimensions (060)

**Date**: 2026-05-27
**Plan**: [plan.md](./plan.md)

Цель документа: показать как **локально** проверить, что фича работает после реализации. Используется реализатором (Codex / live developer) и QA при manual smoke-тестах.

---

## Предусловия

- Локальный dev-сервер запущен: `pnpm --filter @soliton/web dev`
- Локальная Postgres БД работает (Docker compose в `deploy/` или локальный установлен)
- В каталоге есть хотя бы один товар (есть seeded — 66 шт.)
- ApiShip ключ настроен в `.env.local` (`APISHIP_TOKEN`)

---

## Шаг 1. Заполнить physical-параметры для тестового товара

1. Открыть admin-панель: `http://localhost:3000/admin`
2. Перейти в **Каталог → Товары**, выбрать любой товар (например, `PDU-001`).
3. Прокрутить к секции **«Физические параметры упаковки»**.
4. Заполнить:
   - Масса (г): `8000`
   - Длина (мм): `1500`
   - Ширина (мм): `100`
   - Высота (мм): `100`
5. Сохранить. Должно пройти без ошибок.
6. Вернуться к списку — у этого товара должен появиться индикатор ✓ в колонке `physicalPackaging`.

---

## Шаг 2. Проверить расчёт доставки через API

Скопировать `cartId` любой существующей корзины (например, из админки `Carts → выбрать → token` или создать новую через UI). Затем:

```bash
curl -X POST http://localhost:3000/api/shipping/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "cartId": "cart_test_123",
    "address": {
      "countryCode": "RU",
      "postalCode": "115172",
      "city": "Москва",
      "addressString": "г Москва, ул Тверская, д 1"
    },
    "items": [
      { "sku": "PDU-001", "quantity": 1, "price": 12500 }
    ]
  }'
```

**Ожидание**:
- Response 200 OK
- `rates[].cost` для СДЭК «Курьером до двери» = ощутимо больше дефолтной (≈ +50% или больше, конкретно зависит от тарифа).

Сравнить с тем же запросом для товара БЕЗ заполненных physical (например, PDU-002 если не заполнен) — должна быть видна разница.

---

## Шаг 3. Проверить quantity expansion

Тот же запрос, но `quantity: 5`:

```bash
curl -X POST http://localhost:3000/api/shipping/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "cartId": "cart_test_qty5",
    "address": { "countryCode": "RU", "postalCode": "115172", "city": "Москва", "addressString": "Тверская 1" },
    "items": [
      { "sku": "PDU-001", "quantity": 5, "price": 12500 }
    ]
  }'
```

**Ожидание**:
- Response 200 OK
- `rates[].cost` — заметно больше чем при qty=1 (примерно 3.5×–5× в зависимости от тарифа).

Можно посмотреть в логах ApiShip-запросов (`shipping_logs` коллекция Payload или `console.log` сервера):
```sql
SELECT level, label, jsonb_array_length(input -> 'places') AS places_count FROM shipping_logs ORDER BY id DESC LIMIT 5;
```
Должно быть `places_count: 5` для последнего запроса.

---

## Шаг 4. Проверить через UI checkout

1. Открыть `http://localhost:3000/cart`.
2. Добавить товар `PDU-001` в количестве 5.
3. Перейти к оплате (страница checkout физического покупателя).
4. Ввести адрес доставки (например, тот же московский).
5. Дождаться расчёта вариантов доставки.
6. Сравнить отображённую стоимость с шагами 2 и 3.

---

## Шаг 5. Проверить fallback на defaults для товара без physical

1. Найти в каталоге товар, у которого physical НЕ заполнен (индикатор ⚠).
2. Сделать запрос на /api/shipping/calculate с этим SKU.
3. **Ожидание**: response 200 OK, `cost` соответствует дефолтному расчёту (как до фичи).

Это проверяет FR-012 (backward compatibility).

---

## Шаг 6. Проверить кеш-инвалидацию

1. Сделать запрос /api/shipping/calculate для товара X с physical (запомнить `cost`).
2. В админке поменять `physicalPackaging.weightGrams` у X (например, с 8000 на 15000).
3. Повторить запрос /api/shipping/calculate с тем же items.
4. **Ожидание**: `cost` другой (выше из-за большего веса) — значит cache key обновился и расчёт пошёл заново.

Проверяет FR-010 и FR-011.

---

## Шаг 7. Проверить unit-тесты

```bash
pnpm --filter @soliton/web test mappers
```

**Ожидание**: все тесты в `mappers.test.ts` проходят, включая 5 новых из контракта.

---

## Шаг 8. Проверить type-check + lint

```bash
pnpm typecheck
pnpm --filter @soliton/web exec eslint src/lib/shipping/apiship src/app/api/shipping/calculate
```

**Ожидание**: 0 errors. Warnings — допустимо, если они уже были в основной кодовой базе.

---

## Шаг 9. Проверить миграцию (только при подготовке к деплою)

1. На dev: `pnpm exec payload migrate:status` — увидеть pending migration `add_product_physical`.
2. `pnpm exec payload migrate` — применить (на dev уже auto-push могла применить, но создадим formal migration файл).
3. Проверить что в БД новые колонки появились:
   ```bash
   psql $DATABASE_URI -c "\\d products" | grep physical_packaging
   ```
   Должны быть 4 строки.
4. На staging/проде: `deploy/push.sh` сам делает `payload migrate` — никаких ручных действий не нужно.

---

## Откат

Если что-то пошло не так на проде после деплоя:

```bash
ssh pdumarket-prod 'cd /home/server/apps/soliton && docker compose exec -T soliton-web sh -c "cd apps/web && pnpm exec payload migrate:down"'
```

Migration `down` дропнет 4 колонки. Данные о physical-параметрах теряются (это ОК — введённые админом значения, не критичные для существующих заказов), но collection-схема возвращается к предыдущему состоянию.

Если откатывать только код без миграции (например, hotfix через старый деплой) — колонки в БД остаются как NULL, но код не использует поля. Безопасно.
