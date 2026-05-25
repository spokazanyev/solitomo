# Quickstart: Delivery Checkout With ApiShip (047)

**Аудитория**: разработчик, который реализует фичу 047 локально.

## 1. Получить sandbox-токен

1. Зарегистрироваться на [a.apiship.ru](https://a.apiship.ru).
2. Активировать тестовый кабинет (`api.dev.apiship.ru`).
3. Создать API-токен в разделе «Интеграции».
4. Получить (или сгенерировать) `WEBHOOK_SECRET` — произвольная строка, та же
   указывается в кабинете ApiShip для callback URL.

## 2. ENV

В `apps/web/.env.local`:

```bash
APISHIP_TOKEN=eyJ...sandbox...
APISHIP_TEST_MODE=true
APISHIP_BASE_URL=http://api.dev.apiship.ru/v1
APISHIP_WEBHOOK_SECRET=long-random-string

# опционально для DaData (если решим включить в Phase 0 research)
# DADATA_API_KEY=...
# DADATA_SECRET=...
```

## 3. Регенерация TypeScript-клиента из OpenAPI ApiShip

Берём `package.json` скрипты у Medusa-плагина, портируем в `apps/web/package.json`:

```jsonc
{
  "scripts": {
    "shipping:openapi:pull": "rm -rf src/lib/shipping/apiship/openapi && mkdir -p src/lib/shipping/apiship/openapi && curl -L https://api.apiship.ru/doc/openapi.yaml -o src/lib/shipping/apiship/openapi/upstream.yaml && shasum -a 256 src/lib/shipping/apiship/openapi/upstream.yaml > src/lib/shipping/apiship/openapi/SPEC_VERSION.txt",
    "shipping:openapi:gen": "rm -rf src/lib/shipping/apiship/client && openapi-generator-cli generate -i src/lib/shipping/apiship/openapi/upstream.yaml -g typescript-axios -o src/lib/shipping/apiship/client --skip-validate-spec --additional-properties=useSingleRequestParameter=true"
  },
  "devDependencies": {
    "@openapitools/openapi-generator-cli": "^2.25.0"
  }
}
```

Запуск:

```bash
pnpm --filter @soliton/web shipping:openapi:pull
pnpm --filter @soliton/web shipping:openapi:gen
```

## 4. Включить интеграцию в Payload

1. Поднять PG и Payload (как в основном `pnpm dev`).
2. Открыть `/admin/globals/apiship-settings`.
3. Заполнить токен, отправителя, габариты, ставку НДС, разрешённые типы доставки.
4. Нажать «Проверить соединение» — должно вернуться «OK».

## 5. Прогнать чекаут

1. Открыть каталог → положить в корзину 1 PDU.
2. Перейти на `/cart/checkout-physical/`.
3. Ввести адрес «Москва, Тверская, 7».
4. Должно появиться ≥3 варианта доставки.
5. Выбрать СДЭК до ПВЗ → открыть селектор → выбрать ПВЗ.
6. Перейти к оплате (ЮKassa sandbox по 037).
7. После webhook оплаты в Payload Admin открыть заказ → нажать «Создать отправление».
8. Через ~10–30 с появятся `trackingNumber` и кнопки «Этикетка PDF» / «Накладная PDF».

## 6. Webhook ApiShip

Локально:
- Прокинуть туннель (`pnpm exec ngrok http 3000`).
- В кабинете ApiShip указать `https://<ngrok>.io/api/webhooks/apiship`.
- В sandbox-кабинете сменить статус тестового заказа → webhook прилетит, видно
  в логах + в `shipment.events` карточки заказа.

## 7. Что лежит готового

После реализации:

```
apps/web/src/lib/shipping/
├── types.ts                                  # из 047/contracts/shipping-provider.types.ts
├── registry.ts
├── fallback/provider.ts
└── apiship/
    ├── provider.ts                           # из 047/contracts/shipping-provider.apiship.ts
    ├── options.ts                            # порт services/apiship.ts
    ├── mappers.ts                            # порт utils/*
    ├── retry.ts                              # порт executeWithRetry
    ├── cache.ts                              # из 047/contracts/shipping-cache.ts
    ├── points.ts
    ├── webhook.ts
    ├── status-map.ts
    ├── settings.ts
    ├── logger.ts
    ├── client/...                            # сгенерированный typescript-axios
    └── openapi/upstream.yaml
```

## 8. Тесты

- `apps/web/src/lib/shipping/apiship/__tests__/mappers.test.ts` — snapshot mappers (входы взяты из примеров `openapi/upstream.yaml`).
- `apps/web/src/lib/shipping/apiship/__tests__/status-map.test.ts` — таблица из `contracts/apiship-events.md`.
- `apps/web/src/lib/shipping/apiship/__tests__/retry.test.ts` — поведение `executeWithRetry`.
- Playwright e2e:
  - `e2e/checkout-physical-apiship.spec.ts` — happy path с sandbox-токеном.
  - `e2e/checkout-pickup-point.spec.ts` — выбор ПВЗ.

## 9. Откат

Если ApiShip сбоит в проде — выключить через `apiShipSettings.enabled = false`.
Чекаут сразу уходит на `fallback`-провайдер из 037.

## 10. Атрибуция

В `apps/web/src/lib/shipping/apiship/README.md` указать:

> Ядро портировано из открытого проекта
> [gorgojs/medusa-plugins](https://github.com/gorgojs/medusa-plugins)
> (пакет `medusa-fulfillment-apiship`, MIT License). Адаптация под Next.js + Payload.
