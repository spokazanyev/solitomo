# Phase 0 Research — Shipping Package Dimensions (060)

**Date**: 2026-05-26
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

---

## R1. Где хранить физические параметры — на product или на cart/order snapshot?

**Decision**: Хранить только на `Product` (Payload-коллекция `products`). Не делать snapshot в `cart.items` и `orders.items`. На стороне `/api/shipping/calculate` и в момент создания shipment делать server-side lookup по SKU из активной корзины/заказа.

**Rationale**:
- Минимальный объём изменений: только одна миграция и расширение одной коллекции, без перетряски cart-API и order-creation flow.
- Текущие cart.items уже хранят только `{sku, name, qty, priceAtAdd, productId, slug, image}` — добавление 4 новых полей раздуло бы схему, повысило нагрузку на cart-сервис (set physical при POST /items), потребовало бы синхронизации с createOrderFromCart.
- При расчёте доставки уже происходит fetch продуктов через Payload (для других целей) либо это можно добавить с минимальной стоимостью — `payload.find({collection:'products', where:{sku:{in:[...]}}})` — один запрос на корзину размером N SKU, не N+1.
- 66 продуктов в каталоге сейчас — производительность не критична. Когда вырастет — добавим snapshot отдельной фичей.
- Spec FR-013: «Существующие заказы должны оставаться валидными». При подходе через server-side lookup существующие заказы не меняются вообще, миграция касается только `products`.

**Alternatives considered**:

- **Снапшот в `cart.items` (denormalize)**: ускоряет calculate (нет fetch products), консервирует параметры на момент добавления (как `priceAtAdd`). Отклонено: больше изменений, больше риск сломать существующие корзины, преждевременная оптимизация для 66 SKU.
- **Снапшот в `order.items`** (только для immutability после оплаты): технически решает FR-008, но создаёт inconsistency с calculate (где snapshot нет → берётся текущее значение). Лучше консистентный подход: всегда server-side lookup.
- **Только в Carts (без Orders)**: половинчатое решение — после оплаты createShipment всё равно делает lookup. Не даёт изоляции.

**Risk accepted**: если администратор изменит physical-поля товара после того как покупатель добавил его в корзину, но до оплаты — клиент увидит пересчитанную доставку (вероятно, дороже). Это **не баг** — товар реально другой. Мы документируем поведение в Edge Cases (уже в spec.md, абзац «Изменение параметров...»).

---

## R2. Единицы хранения: граммы/миллиметры или килограммы/сантиметры?

**Decision**: Граммы (целое) для массы; миллиметры (целое) для каждого из трёх измерений.

**Rationale**:
- **Целые числа без потерь точности**. Дробные сантиметры или килограммы потребовали бы decimal в Postgres → лишний overhead + риск ошибок округления при суммировании.
- **Совместимость с ApiShip**: их API принимает массу в граммах (целое) и измерения в сантиметрах (целое). При отправке делаем конверсию `mm → cm` через `Math.round(value / 10)` — безопасно потому что 1 мм точность хранения, 1 см в API.
- **Покрытие диапазона**: 1 г … 200 000 г (200 кг) с шагом 1 г — достаточно для PDU и тяжёлых блоков; 1 мм … 2 000 мм (2 м) — покрывает вертикальные стоечные блоки.
- **Понятно админам**: «введите вес в граммах» = просто, без двусмысленности (1.5 кг или 1500 г? — нет вопроса).

**Alternatives considered**:

- **Килограммы (decimal 6.2)**: дробные значения 1.5 кг привычнее. Отклонено: десятичные числа в Postgres дороже, риск ошибок округления при умножении на quantity, конверсия в граммы (для ApiShip) каждый раз = дополнительная логика.
- **Hybrid: масса в кг, размеры в см**: проще для пользователя, но смешанные типы (decimal + int) усложняют код. Отклонено.

**Edge cases**:
- Масса 1 г (минимум) — для очень лёгких аксессуаров (наклейка, шнурок). Допустимо.
- Длина >2000 мм маловероятна для PDU (даже самые длинные вертикальные < 2 м). Если потребуется — расширим лимит.

---

## R3. Как реализовать `quantity` expansion в массиве `places`?

**Decision**: В `toCalculatorRequest` (и в `toOrderRequest`) использовать `flatMap` + `Array.from({length: qty}, () => makePlace(item))`. То есть для каждого item.quantity создаётся N идентичных мест.

**Rationale**:
- Простейший и самый явный способ. Понятно из кода что 5 штук = 5 мест.
- ApiShip /v1/calculator принимает массив `places` любой длины — нет ограничений по 50 мест.
- Не требует упаковщика (вложенной логики «как объединить»). Каждая единица = отдельное место.
- Согласовано с spec.md Assumptions: «Параметр единица упаковки = единица товара».

**Code shape**:

```typescript
const placesFlat = input.items.flatMap((item) => {
  const w = item.weightGrams ?? settings.defaults.weight;
  const lMm = item.lengthMm ?? settings.defaults.length * 10;
  const wdMm = item.widthMm ?? settings.defaults.width * 10;
  const hMm = item.heightMm ?? settings.defaults.height * 10;
  return Array.from({ length: item.quantity }, () => ({
    cost: item.price,
    weight: w,
    length: Math.round(lMm / 10),
    width: Math.round(wdMm / 10),
    height: Math.round(hMm / 10),
  }));
});
```

Note: defaults живут в `apiship-settings` уже в см и г (исторически). При отсутствии item.lengthMm используется settings.defaults.length * 10 (декларируем что в БД хранится мм). При наличии — конвертация mm → cm.

**Alternatives considered**:

- **Один `place` с агрегированным весом (5 × weight)**: проще, но неверно семантически — ApiShip считает по объёмному весу для разделённых мест иначе чем для одного большого. Также невозможно проверить лимиты ПВЗ если объединить.
- **Vendor-specific bundling (СДЭК-only)**: оптимизация. Отложено в backlog «упаковщик».

---

## R4. Где делать lookup продуктов в API расчёта?

**Decision**: В `/api/shipping/calculate/route.ts` сразу после parse body, перед вызовом `provider.calculate()`. Используем Payload Local API: `payload.find({collection:'products', where:{sku:{in: skus}}, depth: 0, limit: 100})`.

**Rationale**:
- Один запрос на корзину — `payload.find()` с `where: in [...]` возвращает все нужные продукты разом, не N+1.
- depth=0 — без resolve relationships (нам не нужны категории, картинки, etc.).
- Cache не нужен на уровне route — Payload сам кеширует через Drizzle query cache. Кеш расчёта (`shipping_calculations`) уже хеширует items с physical полями, так что одинаковые корзины не делают повторный lookup.
- При cache hit calculate возвращает закешированный результат БЕЗ lookup — экономия 0 строк read для cache hit.

**Alternatives considered**:

- **Фронт сам грузит physical из products**: лишний trip, риск утечки данных (нужно делать публичный API для physical). Отклонено.
- **Lookup в mapper'е**: смешивает чистую функцию (mapper) с side effects (DB query). Отклонено по принципу разделения.
- **Lookup в provider.calculate()**: тоже допустимо. Но удобнее держать DB-зависимую логику ближе к route — mapper остаётся pure functional, провайдер тоже без зависимостей от Payload.

**Code shape** в route:

```typescript
const skus = body.items.map(i => i.sku);
const products = await payload.find({ collection: 'products', where: { sku: { in: skus } }, depth: 0, limit: 100 });
const bySku = new Map(products.docs.map(p => [p.sku, p]));
const enrichedItems = body.items.map(i => {
  const p = bySku.get(i.sku);
  return { ...i, weightGrams: p?.physicalPackaging?.weightGrams, lengthMm: p?.physicalPackaging?.lengthMm, ... };
});
const result = await provider.calculate({ ...body, items: enrichedItems });
```

---

## R5. Аналогичный lookup при createShipment

**Decision**: В `ApiShipProvider.createShipment` (или в wrapper-функции которая её вызывает) тоже делать lookup продуктов по SKU из `OrderForShipment.items`. Mapper `toOrderRequest` будет получать уже обогащённый order.

**Rationale**:
- Симметрично с расчётом — те же данные.
- `OrderForShipment` строится из Payload `orders` после успешной оплаты. SKU там уже есть (см. items.sku в orders schema).
- Тот же `payload.find` pattern.

**Edge case**: товар мог быть удалён между оплатой и созданием waybill (редкий сценарий). В этом случае lookup вернёт пустой `bySku.get(sku)` → fallback на дефолты. Логируем warning, но не блокируем создание waybill.

**Where exactly**: проще всего в текущей точке — в `provider.ts` файле, в методе `createShipment`. Можно либо принимать `order` уже enriched (контракт меняется), либо делать lookup внутри — оставляем lookup внутри для симметрии с calculate-route и для backward compatibility у внешних вызывающих.

---

## R6. Payload v3 group field с валидацией

**Decision**: Использовать `type: 'group'` с именем `physicalPackaging`. Поля внутри — 4 number fields с min/max валидацией через `validate` callback (если нужна более сложная) или через built-in min/max.

**Rationale**:
- Payload v3 группы рендерятся в admin как collapsible section — соответствует UX из FR-002 «выделенная секция».
- Number fields с `min`, `max` дают встроенную валидацию в admin и через REST API.
- Группа сама опциональна — если ни одно поле не заполнено, секция показывается пустая (нормально).
- Drizzle migrate автоматически генерит колонки `physical_packaging_weight_grams`, `physical_packaging_length_mm` и т.д.

**Code shape**:

```javascript
{
  name: 'physicalPackaging',
  type: 'group',
  label: adminLabel('Физические параметры упаковки', 'Physical packaging'),
  admin: { description: adminLabel('Заполните для точного расчёта доставки. Пусто = используются дефолтные значения.', '...') },
  fields: [
    { name: 'weightGrams', type: 'number', label: 'Масса, г', min: 1, max: 200000, admin: { step: 1 } },
    { name: 'lengthMm', type: 'number', label: 'Длина, мм', min: 1, max: 2000, admin: { step: 1 } },
    { name: 'widthMm', type: 'number', label: 'Ширина, мм', min: 1, max: 2000, admin: { step: 1 } },
    { name: 'heightMm', type: 'number', label: 'Высота, мм', min: 1, max: 2000, admin: { step: 1 } },
  ],
}
```

**Alternatives considered**:

- **Отдельные top-level поля** (без группы): загромождает карточку. Отклонено.
- **JSON-поле с произвольной структурой**: труднее валидировать. Отклонено.
- **Array из «пакетов»** (если будут варианты упаковки): сейчас не нужно, единичный пакет = модель MVP. Если в будущем понадобится bundling — отдельная фича.

---

## R7. Индикатор «не заполнено» в admin list view

**Decision**: Добавить виртуальное boolean-поле `hasPhysicalPackaging` через Payload `hooks.beforeRead` или собрать его в `defaultColumns` через custom cell component.

**Rationale**:
- Spec FR-005: список товаров MUST иметь визуальный индикатор пустых физических параметров.
- Простейший путь: custom cell для колонки `physicalPackaging` в admin list, который показывает ✓ или ⚠ в зависимости от заполненности всех 4 полей.
- Альтернатива через computed field (virtual) — добавляет сложность с indexes. На 66 SKU не критично.

**Implementation note**: в Payload v3 можно сделать через `admin.components.Cell` для default columns. Простой компонент `<PhysicalPackagingStatus>` показывает emoji + tooltip. Альтернативно сделать через колонку `defaultColumns: [..., 'physicalPackaging.weightGrams']` — Payload отображает значение или empty. Но для UX лучше явный ✓/⚠ индикатор. Минимальный объём — JSX компонент 20 строк.

**Alternatives considered**:

- **Filter в admin list view** «показать только без physical»: полезно, но не входит в spec. Отложено как backlog.
- **Bulk-update tool «заполнить дефолтом»**: спека прямо говорит «out of scope». Откладываем.

---

## R8. Кеш расчёта — что менять

**Decision**: НИЧЕГО не менять в `calcInputFingerprint`. Текущая реализация уже хеширует `items.{p,q,w,l,wd,h}` — после нашей фичи в `w/l/wd/h` будут реальные значения вместо undefined → ключи закешированных результатов автоматически инвалидируются для всех товаров с заполненными physical.

**Rationale**:
- Fingerprint функция написана как раз в расчёте на этот сценарий: «обновится поведение items → ключ изменится → cache miss → свежий расчёт».
- Для существующих корзин с дефолтными расчётами: после деплоя `enrichedItems` для тех же товаров без physical передадут undefined в w/l/wd/h (как сейчас) → ключ останется прежним → cache hit (правильно — расчёт не изменился).
- Для товаров с заполненными physical: значения добавятся в items → новый fingerprint → cache miss → свежий расчёт → закешируется заново. Так и нужно.

**Verification step**: после деплоя выполнить `SELECT key, created_at FROM shipping_calculations LIMIT 5;` на проде — должны увидеть новые ключи с другими hash после первого расчёта для товара с заполненным physical.

---

## R9. Тестирование

**Decision**: Unit-тесты mapper'а через Vitest в существующем `apps/web/src/lib/shipping/apiship/__tests__/mappers.test.ts`. Добавить группу test cases:

1. `toCalculatorRequest expands quantity into N places` — item с qty=5 → places.length === 5
2. `toCalculatorRequest uses item.physical when present` — item с weight=2000, lengthMm=400 → place.weight=2000, length=40 (cm)
3. `toCalculatorRequest falls back to settings.defaults when physical missing` — item без weight → place.weight=settings.defaults.weight
4. `toCalculatorRequest handles mixed cart` — один item с physical, другой без → каждый получает свои данные
5. `toOrderRequest` аналогично

Integration test (manual): через `pnpm dev` локально:
1. В админке создать тестовый продукт с physical (8000 г, 1500×100×100 мм)
2. Добавить в корзину, qty=2
3. Открыть checkout, ввести адрес → проверить что в /api/shipping/calculate response.cost больше чем дефолтная цена
4. Сравнить с тем же товаром qty=1 — цена должна быть меньше (один пакет vs два)

**Rationale**: Vitest уже настроен, существующий test file есть как опорный пример. Покрытие mapper'а критично — это core логики фичи.

---

## R10. Migration strategy

**Decision**: Один formal migration файл `apps/web/src/migrations/YYYYMMDDHHMMSS_add_product_physical.ts` с up: ADD COLUMN nullable, down: DROP COLUMN. Schema автогенерируется Drizzle когда мы запускаем `pnpm payload generate:types` после изменения collection — потом просто захостить migration вручную.

**Workflow**:
1. Изменить `apps/web/src/collections/Catalog.js` (добавить group physicalPackaging).
2. На dev: `pnpm payload migrate` запускает auto-push в dev режиме → колонки появляются.
3. На dev сгенерировать formal migration: `pnpm payload migrate:create add_product_physical` → создаётся файл в `src/migrations/`.
4. Закоммитить migration файл.
5. На prod через `deploy/push.sh` — step 5c уже выполняет `pnpm exec payload migrate` → migration применяется автоматически.

**Rollback plan**: если что-то сломается на проде, откат:
```bash
ssh pdumarket-prod 'cd /home/server/apps/soliton && docker compose exec -T soliton-web sh -c "cd apps/web && pnpm exec payload migrate:down"'
```
Колонки nullable → данные не теряются.

**Rationale**: стандартный flow Payload v3 для prod миграций (см. также `deploy/push.sh` step 5c с комментарием про NODE_ENV=production).

---

## Summary table

| Решение | Кратко |
|---|---|
| R1 | Хранить только на Products, lookup в API расчёта (не в snapshot cart/order) |
| R2 | Граммы + миллиметры, целые числа |
| R3 | flatMap по quantity, каждая единица = отдельное место |
| R4 | Lookup в `/api/shipping/calculate/route.ts` через `payload.find({where:{sku:{in:[]}}})` |
| R5 | Аналогичный lookup в `provider.createShipment` |
| R6 | Payload `type: 'group'` field `physicalPackaging`, built-in min/max validation |
| R7 | Custom Cell component для колонки в admin list с emoji-индикатором |
| R8 | Кеш не трогаем — fingerprint уже учитывает physical поля |
| R9 | Vitest unit tests на mapper, manual smoke в dev |
| R10 | Standard Payload migration, deploy через существующий push.sh |

**All NEEDS CLARIFICATION resolved. Ready for Phase 1 — Design.**
