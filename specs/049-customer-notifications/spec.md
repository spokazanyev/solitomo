# Feature Specification: Customer Notifications

**Feature Branch**: `049-customer-notifications`

**Created**: 2026-05-23

**Status**: Draft

**Input**: Полноценный модуль клиентских уведомлений по событиям жизненного цикла заказа. **Email + админ-канал**. SMS — **не используется** (решение владельца от 2026-05-23: только email; альтернативный второй канал — мессенджеры (Telegram/MAX) — закладывается архитектурно, реализация позже). Шаблонизатор, очередь с retry/dedup, opt-in/opt-out, журнал, маска ПДн. Источник событий — event emitter из 047.

## Контекст и связи

- **Канонический документ**: `07-build-specifications/order-lifecycle-spec.md §3` — матрица уведомлений (16 событий × каналы × получатели).
- **Контракты**: `contracts/notification-events.md` (перенесён из 047).
- **Зависимости**: 047 предоставляет `emitDomainEvent` и доменные события.
- **Минимальный stub в 047**: для 4 транзакционных писем (paid/shipped/delivered/closed) — без матрицы и очереди, прямой вызов email-провайдера. После релиза 049 stub снимается.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Покупатель получает email на каждом ключевом событии (Priority: P1)

После событий `order.paid`, `shipment.created` (трек), `shipment.at_point`, `shipment.delivered`, `order.completed` клиент получает фирменный email в течение SLA (см. order-lifecycle-spec.md §7), один раз на событие, с понятным текстом, ссылками на страницу заказа и трекинг.

**Why this priority**: основа клиентского опыта; без email клиент не знает, что заказ движется.

**Independent Test**: оформить тестовый заказ в sandbox → пройти статусы → на mailtrap-ящик приходят 5 писем правильных шаблонов в нужные моменты, без дублей.

**Acceptance Scenarios**:

1. **Given** webhook `order.paid`, **When** обработан, **Then** в течение 60 с уходит email `T-001`; в `Order.notifications[]` запись `status=sent`.
2. **Given** webhook ApiShip → `shipment.created`, **When** обработан, **Then** email `T-003` с trackingNumber.
3. **Given** webhook ApiShip → `shipment.at_point`, **When** обработан, **Then** email `T-004` с адресом ПВЗ и `pickupExpiresAt`.
4. **Given** одно и то же событие пришло дважды (idempotent), **When** обработано повторно, **Then** второе письмо не отправляется (запись `status=skipped, reason=duplicate`).
5. **Given** email-провайдер вернул 5xx, **When** job сработал, **Then** retry с экспоненциальным backoff'ом, до 5 попыток.

---

### User Story 2 — Второй канал «мессенджеры» как pluggable provider (Priority: P3, архитектурный задел)

В абстракции `NotificationChannel` помимо email и admin_ui заложен **универсальный канал `messenger`** для будущей интеграции с Telegram-ботом / MAX / VK Messages. В MVP 049 этот канал **не реализуется** (нет shippable provider), но архитектура его поддерживает: в матрице `notification-events.md` указан тип `messenger`, в `notification-jobs` channel может принимать значение `messenger`, в `notificationsSettings` есть выключенный блок настроек. Реализация конкретного провайдера — отдельная follow-up спека 050 (Telegram bot).

**Why this priority**: владелец решил, что вторым каналом будут мессенджеры (а не SMS). Архитектурный задел в 049 нужен, чтобы 050 не требовал переделок 049/047.

**Independent Test**: в матрице есть правило с `channel=messenger`, scheduler видит запись `notification-jobs.channel=messenger`, но падает в no-op (sender не зарегистрирован). Никаких рантайм-ошибок.

**Acceptance Scenarios**:

1. **Given** правило `event=order.paid, channel=messenger`, **When** scheduler обрабатывает job, **Then** `status=skipped, reason=no_sender_registered` (без ошибки).
2. **Given** в будущем 050 регистрирует Telegram-sender, **When** job обрабатывается, **Then** реальный сендер срабатывает без правок 049.

> SMS-канал в 049 **не реализуется**. SMS-провайдеры (SMSC/SMS-aero), шаблоны T-201..T-206, поля `Order.smsOptIn` — **удалены**.

---

### User Story 3 — Менеджер получает уведомления о критических событиях (Priority: P1)

Менеджер указан в `notificationsSettings.managers[]`. На события `order.paid`, `order.invoice_issued`, `shipment.error`, `order.stuck`, `order.cancelled` ему уходит email из шаблонов T-101..T-105 с прямой ссылкой на карточку заказа в Payload Admin и опционально в Twenty.

**Why this priority**: без этих писем менеджер не реагирует своевременно.

**Independent Test**: новый paid заказ в sandbox → менеджеру приходит T-101 за SLA ≤2 мин.

**Acceptance Scenarios**:

1. **Given** новый paid заказ, **When** webhook ЮKassa, **Then** менеджеру (всем из списка) уходит `T-101`.
2. **Given** `shipment.status=error`, **When** обработан, **Then** менеджеру `T-103` с текстом ошибки.

---

### User Story 4 — Напоминания и пост-доставка (Priority: P2)

Cron-задачи:
- За 24±2 часа до конца срока хранения в ПВЗ → клиенту `T-007` (email).
- При `order.completed` → клиенту `T-008` («оцените покупку», ссылка на `/cart/order/[token]/review/`).

**Why this priority**: критично для ПВЗ-возвратов и для повторной продажи.

**Independent Test**: фейковый заказ с `pickupExpiresAt = now() + 25 ч` → cron сработал → email `T-007` отправлен, повторный запуск cron не плодит письмо.

**Acceptance Scenarios**:

1. **Given** `shipment.status=at_point` и `pickupExpiresAt ∈ [now+22h, now+26h]` и нет отправленного `T-007`, **When** cron, **Then** отправить.
2. **Given** уже отправлено, **When** следующий cron, **Then** пропустить (`status=skipped, reason=already_sent`).

---

### User Story 5 — Администратор настраивает каналы и шаблоны (Priority: P2)

В Payload Admin Global `notificationsSettings`: выбор email-провайдера (Postmark / Mailgun / SendPulse), API-ключи (маскированы), список email-адресов менеджеров, от какого имени отправлять. Connection check email-провайдера. (Блок messenger-канала — выключенный placeholder для спеки 050.)

**Why this priority**: без настройки модуль не работает; нужны явные настройки.

**Independent Test**: открыть global → ввести валидные ключи Postmark sandbox → нажать «Проверить» → status OK.

---

### User Story 6 — Полноценный opt-out и предпочтения клиента (Priority: P3)

Публичная страница `/preferences/[token]/` позволяет клиенту:
- Отписаться от маркетинговых писем (но не от транзакционных).
- Включить/выключить будущий канал «мессенджеры» (placeholder, пока без эффекта).
- Сменить email.

**Why this priority**: 152-ФЗ требование на отзыв согласия; не critical для MVP, но обязательно перед маркетинговыми рассылками.

---

### Edge Cases

- **Bounce/Soft-bounce email**: после 3 hard bounce от одного адреса — пометить `Order.customer.emailValid=false`, не пытаться больше.
- **Долгий outage email-провайдера**: jobs накапливаются; алерт владельцу при queue > 100 jobs в `queued` >30 мин.
- **Невалидный email клиента** (typo): первая попытка → 5xx/4xx → один retry → `failed`; письмо менеджеру «связаться с клиентом, неверный email».
- **Шаблон ссылается на отсутствующее поле** (например, `pickupExpiresAt` для курьерской доставки): шаблонизатор подставляет fallback или скрывает блок.
- **Несколько менеджеров для одного юрлица**: все получают T-101..T-105 (broadcast по `notificationsSettings.managers[]`).
- **Cart abandonment** (`cart.abandoned` через 1 час): за feature-flag; отключаем по умолчанию.
- **Сообщение в messenger-канал, но 050 ещё не релизнута** → job становится `skipped, reason=no_sender_registered`. Email-копия всё равно уходит.

## Requirements *(mandatory)*

### Functional Requirements

#### Каналы и инфраструктура

- **FR-4901**: System MUST реализовать абстракцию `NotificationSender { sendEmail, sendMessenger, sendCrm }`, конкретные реализации провайдеров — отдельные модули. Если sender для канала не зарегистрирован — job становится `skipped, reason=no_sender_registered`.
- **FR-4902**: System MUST поддерживать каналы `email` (обязательный) и `messenger` (архитектурный placeholder для спеки 050). **SMS-канал не поддерживается.**
- **FR-4903**: System MUST ставить уведомления в очередь `notification-jobs` со статусами `queued/in_progress/sent/failed/skipped`.
- **FR-4904**: System MUST обрабатывать очередь cron-задачей каждые 30 с.
- **FR-4905**: System MUST уметь retry до 5 попыток для transient errors (5xx, timeout) с экспоненциальным backoff'ом (baseDelaySec из notificationsSettings, по умолчанию 30 с); 4xx (invalid email, opt-out etc) — без ретраев. Согласовано с order-lifecycle-spec §7 и 048.
- **FR-4906**: System MUST маскировать ПДн в логах: email → `***@domain`, телефон → последние 4 цифры.
- **FR-4907**: System MUST не выводить API-ключи на клиент.

#### Шаблонизация

- **FR-4910**: System MUST использовать единый шаблонизатор (выбор — React-email / Handlebars / MJML — в research.md).
- **FR-4911**: System MUST поддерживать русский и английский (на MVP — только русский, en — расширение).
- **FR-4912**: System MUST хранить шаблоны как код (версионируемые), не в БД.
- **FR-4913**: System MUST уметь рендерить шаблон с fallback'ами на отсутствующие поля.

#### Матрица уведомлений

- **FR-4920**: System MUST реализовать матрицу из `contracts/notification-events.md`. Изменения матрицы — через код (PR).
- **FR-4921**: System MUST поддерживать `requires` правила (`marketingOptIn`, `emailValid`, `messengerOptIn` — последнее placeholder для 050).
- **FR-4922**: System MUST дедуплицировать по ключу `orderId+event+channel+recipient+bucket(at, 24h)`.

#### Cron-задачи

- **FR-4930**: System MUST cron `pickup-reminder-24h` запускается каждый час.
- **FR-4931**: System MUST cron `stuck-order-alert` запускается каждые 6 часов.
- **FR-4932**: System MUST cron `notification-runner` запускается каждые 30 с.

#### Admin

- **FR-4940**: System MUST хранить настройки в Payload global `notificationsSettings`.
- **FR-4941**: System MUST позволять менеджерам через UI просматривать `Order.notifications[]` журнал.
- **FR-4942**: System MUST поддерживать «ручную пересылку» письма из карточки заказа (например, клиент потерял T-001 — менеджер кликает «Переотправить»).

#### Privacy

- **FR-4950**: System MUST реализовать страницу `/preferences/[token]/` для opt-out (US6, P3).
- **FR-4951**: System MUST включать в каждое маркетинговое письмо ссылку отписки (обязательное требование ФЗ).
- **FR-4952**: System MUST уважать opt-out при следующей отправке (не отправлять, помечать skip).

### Key Entities

- **Payload global `notificationsSettings`**: email-provider, email-apiKey, email-from, `managers[]`, marketing-opts, messenger-placeholder.
- **Payload collection `notification-jobs`**: см. data-model §2.
- **`Order.notifications[]`**: журнал.
- **`Order.marketingOptIn`, `Order.messengerOptIn` (placeholder для 050), `Order.customer.emailValid`**: флаги предпочтений.

## Success Criteria *(mandatory)*

- **SC-001**: ≥99% транзакционных email доставляются за SLA из order-lifecycle §7 в течение 30 дней.
- **SC-002**: ≤1% bounce-rate за 30 дней.
- **SC-003**: 0 утечек API-ключей в client bundle.
- **SC-004**: ≥95% дубликатов отсекается (по логу `skipped, reason=duplicate`).
- **SC-005**: Снижение возвратов из ПВЗ из-за неполучения посылок ≥20% к/к после внедрения `T-007` (целевое снижение скромнее без SMS).
- **SC-006**: 100% маркетинговых писем содержат ссылку отписки (автотест в CI).
- **SC-007**: Абстракция `NotificationSender` корректно обрабатывает `channel=messenger` (skipped без падения), готовность к 050 проверена интеграционным тестом.

## Assumptions

- Email-провайдер ещё не выбран (Q1 в order-lifecycle открыт); 049 за feature-flag `notificationsSettings.enabled=false` до выбора. Архитектурно поддерживаются Postmark / Mailgun / SendPulse (адаптер абстрактный, выбор не блокирует код).
- **SMS-канал не реализуется** (решение владельца от 2026-05-23). Второй канал — мессенджеры (Telegram-бот / MAX) — отдельная спека 050.
- 047 уже эмитит события правильно.
- Шаблоны можно показать к согласованию владельцу до релиза.

## Out Of Scope

- **Маркетинговые автоматизации** (welcome-серия, win-back, drip-кампании) — отдельная спека позже.
- **A/B тесты шаблонов** — отдельная спека.
- **SMS-канал** — решено не реализовывать вообще; вместо него — мессенджеры.
- **Telegram / MAX / VK Messages — реальная реализация** — спека **050**. В 049 — только абстрактный канал `messenger` без sender'а.
- **Push-уведомления в браузер/PWA** — отдельная спека.
- **Шаблоны для возвратов** (T-возврат) — после реализации возвратов в платёжном модуле.
- **Дашборд статистики уведомлений** — Twenty или отдельный admin-плагин.
