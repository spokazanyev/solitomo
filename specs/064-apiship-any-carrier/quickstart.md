# Quickstart / Manual Smoke: ApiShip — поддержка любого перевозчика (064)

Ручная проверка после реализации. Предусловие: ApiShip-настройки заданы, локальный dev (`pnpm --filter @soliton/web dev`) + `payload migrate` применён.

## Подготовка

```bash
# из корня репо
pnpm --filter @soliton/web migrate     # применить 20260528_064_delivery_channel
pnpm --filter @soliton/web dev
```

## Сценарии

### S1 — Юрлицо, перевозчик вне прежних трёх (US1, FR-001/002/004)

1. Корзина → «Выставить счёт» → `InvoiceCheckoutForm`.
2. Канал «Служба доставки», адрес → выбрать **Деловые Линии / DPD / IML** (любой не-СДЭК/Boxberry/Почта).
3. Оформить заказ.
4. **Ожидание**: в админке заказ имеет `delivery.channel = service`, `providerKey` выбранной службы, `providerName` (имя), `cost > 0`, заполнены `deliveryType`, адрес/ПВЗ, сроки. **Стоимость НЕ 0.**

### S2 — Юрлицо, ПВЗ vs курьер (US1 AC2/AC3, FR-002)

1. Повторить S1 с тарифом «до ПВЗ» → проверить сохранённые `pointId` + `pointAddress`, `deliveryType="2"`.
2. Повторить с курьером до двери → `deliveryType="1"`, сохранён city+address.

### S3 — Физлицо (card), произвольный перевозчик (US1 AC, FR-010)

1. Корзина → «Оплатить картой» → расчёт доставки → выбрать перевозчика вне трёх прежних → «Проверка» → оформить (до редиректа в ЮKassa достаточно создания Order).
2. **Ожидание**: Order сохранён с полным блоком ApiShip (раньше physical-flow терял блок даже для cdek) — `channel=service`, `providerKey`, `providerName`, `deliveryType`, адрес/ПВЗ, `cost>0`.

### S4 — PDF-счёт и карточка (US2, FR-006/007, SC-004)

1. Для заказа из S1 открыть PDF-счёт (`/api/invoice/{orderId}`) и карточку `/cart/order/{token}/`.
2. **Ожидание**: блок «Доставка» — имя службы (или код-fallback), тип (ПВЗ/курьер), адрес, срок. Без пустых полей/ошибок.

### S5 — Неизвестный / пустой код перевозчика (Edge, FR-009)

1. Смоделировать заказ с `providerKey` вне маппинга `providerNameFromKey` → имя = код.
2. С пустым/`unknown` → «служба доставки». Заказ оформляется, PDF без ошибок.

### S6 — Каналы pickup / own_carrier (FR-008)

1. Оформить заказ «Самовывоз» и «ТК покупателя».
2. **Ожидание**: `cost = 0`, блок «Примечания»/адрес склада в PDF, без блока перевозчика. handoverNote-валидация (pickup ≥5, own_carrier ≥10) работает как в 062.

### S7 — Denylist (FR-005, SC-003)

1. Добавить службу в `ApiShipSettings.disabledProviders` → она не предлагается на чекауте.
2. Убрать из denylist → снова доступна. **Без изменений кода/схемы/релиза.**

## Гейты качества

```bash
pnpm typecheck
pnpm lint
pnpm --filter @soliton/web test     # delivery-channel.test.ts + handover-validation.test.ts зелёные
```

## Критерии приёмки (соответствие SC)

- **SC-001/SC-002**: ни один service-перевозчик не теряет стоимость/данные (S1–S3).
- **SC-003**: denylist управляет доступностью без кода (S7).
- **SC-004**: PDF/админка показывают имя+тип+адрес для любого (S4–S5).
