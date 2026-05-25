# Twenty Custom Fields Catalogue

**Spec**: 048-twenty-crm-sync

Канонический список кастомных полей, создаваемых скриптом `pnpm crm:migrate-fields`.

## Opportunity (стандартный объект, расширяем)

| Key                | Type      | Required | Description                                |
|---|---|---|---|
| `externalId`       | TEXT      | ✓        | `Order.id` из Soliton — unique             |
| `externalToken`    | TEXT      | ✓        | `Order.publicToken`                         |
| `orderUrl`         | URL       | ✓        | Прямая ссылка на страницу заказа           |
| `shippingProvider` | TEXT      |          | "cdek", "boxberry"…                         |
| `shippingCost`     | CURRENCY  |          | Стоимость доставки                          |
| `trackingNumber`   | TEXT      |          | Трек-номер                                  |
| `trackingUrl`      | URL       |          | Трек-страница перевозчика                   |
| `shippingAddress`  | TEXT      |          | Адрес доставки (long)                      |
| `pickupPointAddress` | TEXT    |          | Если доставка в ПВЗ                         |
| `pickupExpiresAt`  | DATE      |          | Срок хранения в ПВЗ                         |
| `fulfillmentStage` | SELECT    | ✓        | New / Quote / Paid / In fulfillment / In transit / At point / Delivered / Closed / Returned / Cancelled / Won.Refunded / Won.PartialRefund |
| `deliveredAt`      | DATE      |          |                                             |
| `closedAt`         | DATE      |          |                                             |
| `disputeFlag`      | BOOLEAN   |          | Маркер диспута                              |
| `nps`              | NUMBER    |          | Оценка от клиента 1–10 (заполняется из 049) |
| `returnsCount`     | NUMBER    |          | Количество возвратов по заказу (053)        |
| `totalRefunded`    | NUMBER    |          | Общая сумма возвратов, ₽ (053)              |
| `lastReturnNumber` | TEXT      |          | Номер последнего возврата, напр. RT-2026-0007 (053) |

## Company (стандартный объект, расширяем для юрлиц)

| Key            | Type | Required | Description |
|---|---|---|---|
| `taxId`        | TEXT | ✓        | ИНН (unique по нему делаем upsert) |
| `kpp`          | TEXT |          | КПП                                 |
| `ogrn`         | TEXT |          | ОГРН                                |
| `legalAddress` | TEXT |          | Юр. адрес                           |

## Person (стандартный объект, расширяем)

| Key             | Type    | Description                                 |
|---|---|---|
| `sourceUtm`     | TEXT    | UTM-метка, с которой пришёл (опц.)         |
| `smsOptIn`      | BOOLEAN | (deprecated, не используется — заменён на messenger, спека 050) |
| `marketingOptIn`| BOOLEAN | Согласие на маркетинг                       |
| `customerType`  | SELECT  | individual / company-contact                |

## Migration script behaviour

`apps/web/scripts/crm-migrate-fields.ts`:

1. Загружает каталог из этого файла (parser markdown-таблиц или TS-константа).
2. Идёт через GraphQL introspection на Twenty workspace.
3. Для каждого поля:
   - Если нет → создаёт через `createObjectMetadataField` mutation.
   - Если есть с тем же type → пропускает.
   - Если есть с разным type → флаг `--apply` создаёт миграцию (deprecate + create new); без флага — ошибка.
4. Выводит отчёт: создано / пропущено / конфликтов.

Параметры:

- `--dry-run` (по умолчанию): только отчёт, без изменений.
- `--apply`: применяет изменения.
- `--workspace=<id>`: целевой workspace (если не указан — из env `TWENTY_WORKSPACE_ID`).
