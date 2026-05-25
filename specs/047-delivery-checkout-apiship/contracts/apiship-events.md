# ApiShip Events → Internal Mapping

Документ — единая правда для маппинга провайдерских статусов ApiShip во внутренние
`shipment.status` и `orders.status`. Используется в `lib/shipping/apiship/status-map.ts`
и в обработке webhook (`contracts/shipping-webhook.handler.ts`).

## Таблица маппинга

| ApiShip code | ApiShip text                    | `shipment.status` | `orders.status` upgrade |
|--------------|----------------------------------|-------------------|--------------------------|
| 1            | Новый                            | `created`         | —                        |
| 2            | На согласовании                  | `created`         | —                        |
| 3            | Передан в службу доставки        | `in_transit`      | `shipped`                |
| 4            | Принят перевозчиком              | `in_transit`     | `shipped`                |
| 5            | В пути                           | `in_transit`     | `shipped`                |
| 6            | Прибыл в ПВЗ                     | `at_point`        | `shipped`                |
| 7            | Вручён получателю                | `delivered`       | `delivered`              |
| 8            | Возврат отправителю              | `returned`        | (manual)                 |
| 9            | Отменён                          | `cancelled`       | `cancelled`              |
| 10           | Проблема                         | `error`           | (manual)                 |
| —            | label_ready                      | `created`         | —                        |
| —            | label_failed                     | `error`           | (manual)                 |

## Правила повышения

1. `shipment.status` повышается только если ранг нового ≥ ранг текущего:
   `none < pending < created < pending_label < in_transit < at_point < delivered`
   и терминальные `cancelled`, `returned`, `error` отдельной группой.
2. Терминальные статусы `delivered`, `cancelled`, `returned` не понижаются.
3. `orders.status` повышается только по правилам выше («Передан в службу» → `shipped`,
   «Вручён» → `delivered`, «Отменён» → `cancelled`). Остальные — без изменений.
4. Если webhook пришёл с более ранним `at`, чем самый поздний eventAt в
   `shipment.events`, событие добавляется в массив (для аудита), но статусы не понижаются.

## Open questions

- Точные числовые коды (1–10) сверить с актуальным OpenAPI ApiShip (`openapi/upstream.yaml`).
  Текущая таблица собрана по docs.apiship.ru. После регенерации клиента в фазе Phase 1
  уточнить и обновить.
- Состояние «передано курьеру для возврата» (отдельное?) — на момент v1 опустим, обрабатываем как `returned`.
