# Feature Specification: Customer Account & Identity

**Feature Branch**: `054-customer-account`

**Created**: 2026-05-23

**Status**: Draft

**Input**: До сих пор все заказы в Soliton — **guest-orders**: на каждый чекаут клиент заново вводит ФИО / email / телефон, нет «истории моих заказов», нет привязки нескольких заказов к одному человеку, нет привязки заказов юрлица к одной компании. В Twenty (спека 048) уже есть `Person` и `Company`, но в Soliton своих сущностей `Customer` / `Company` нет — данные дублируются плоско в `Order.customer.*`. Эта спека вводит сущности `customers` + `companies`, минимальный личный кабинет (`/account/*`), magic-link для гостей, регистрацию для постоянных клиентов, B2B-роли и двустороннюю синхронизацию с Twenty.

## Контекст и связи

- **Канонический документ**: `07-build-specifications/order-lifecycle-spec.md §4` (маппинг Person/Company в Twenty уже описан — здесь мы создаём «зеркало» на нашей стороне).
- **Зависимости**:
  - Спека 047 (`specs/047-delivery-checkout-apiship/`) — текущий guest-checkout, источник анонимных Order. После 054 чекаут расширяется опциональной идентификацией (без блокирования гостя).
  - Спека 048 (`specs/048-twenty-crm-sync/`) — Twenty `Person`/`Company` уже создаются из Order. После 054 sync идёт `Customer ↔ Person`, `Company ↔ Company`; Order наследует ссылки через `customerId`/`companyId`.
  - Спека 049 (`specs/049-customer-notifications/`) — поля `marketingOptIn` / `messengerOptIn` / `emailValid` ныне живут на `Order`; после 054 — переезжают на `Customer` (Order наследует через customerId или snapshot на момент заказа).
  - Спека 052 (`specs/052-cart-as-entity/`) — `carts.customerId` появляется в момент логина / merge гостевой корзины.
  - Спека 053 (`specs/053-returns-and-refunds/`) — `returns.customerId` для privacy-фильтра «возвраты только моих заказов».
- **Стек**: Next.js 16 + Payload v3 + PostgreSQL. Сейчас Payload `users` — это **admin-пользователи** (менеджеры). Customer создаётся как **отдельная** auth-collection (`customers`) c `auth: true` — не пересекается с admin-Users.
- **Решения 2026-05-23**:
  - Magic-link предпочтительнее password для гостя (US1) — снижает барьер.
  - Privacy: контактное лицо B2B не видит чужие заказы в той же компании (даже владельца) без явного разрешения. Только владелец компании видит **все** Order.companyId компании.
  - GDPR / 152-ФЗ: экспорт всех данных и удаление по запросу субъекта реализованы как стандартные ручки.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Гость оформил заказ → получил email с magic-link для просмотра заказа без пароля (Priority: P1)

Гость оформил заказ в 047. После `order.paid` (или сразу при `order.created` для счёта юрлица) на его email приходит письмо «Спасибо за заказ» с кнопкой «Открыть заказ». Кнопка ведёт на `/account/magic/[token]/` — токен живёт 30 минут, после клика сессия живёт 24 часа. На этой странице гость видит карточку **только этого** заказа (статус, доставка, трекинг, документы). Внизу — мягкое предложение «Создать пароль и сохранить историю». Пароль не обязателен.

**Why this priority**: критический UX-разрыв сегодня — клиент после оплаты не имеет никакого способа вернуться к заказу, кроме как ждать письма менеджера или искать в почте трек-номер. Снижает нагрузку на менеджера, повышает доверие, готовит почву для US2/US3.

**Independent Test**: тестовый guest-заказ → дойти до paid → проверить, что в письме T-001/T-002 есть валидная magic-link → клик → `/account/orders/[orderId]/` открывается без логина, повторный клик через 31 минуту → ошибка `MAGIC_LINK_EXPIRED` с предложением запросить новую.

**Acceptance Scenarios**:

1. **Given** guest-заказ перешёл в `paid`, **When** event `order.paid` обработан, **Then** в email-шаблоне `T-001` появляется кнопка «Открыть заказ» с URL `https://pdumarket.ru/account/magic/{token}/`, где `token` — однократный 32-байт JWT в БД с `expiresAt = now + 30 min`.
2. **Given** валидный магик-токен, **When** клиент открывает ссылку, **Then** сервер выдаёт session-cookie `customer_session` (24 ч), создаёт/находит запись в `customers` по email, страница `/account/orders/[orderId]/` рендерится.
3. **Given** токен использован один раз, **When** клиент открывает ту же ссылку повторно (например, из истории браузера), **Then** запрос проходит (одноразовость — на consumption, но сессия уже выдана) либо до истечения 30 минут — выдаётся повторно. После 30 минут — `MAGIC_LINK_EXPIRED`, UI предлагает кнопку «Запросить новую ссылку».
4. **Given** клиент не залогинен и попадает по магик-линку на свой заказ, **When** сессия выдана, **Then** в навбаре появляется бейдж «Вы вошли как guest@example.com», CTA «Создать пароль» в подвале страницы.
5. **Given** клиент нажал «Создать пароль» из magic-сессии, **When** ввёл пароль и подтвердил, **Then** `customers.passwordHash` записан (bcrypt cost=12), флаг `customerType = individual` или `company-contact`, история его прошлых guest-заказов с тем же email мигрирует (см. US3).

---

### User Story 2 — Клиент регистрируется (email + пароль) и видит историю своих заказов на /account/ (Priority: P1)

Клиент заходит на `/account/register/`, вводит email + пароль + ФИО + телефон, подтверждает email (опционально, через double opt-in письмо). После подтверждения он попадает в `/account/orders/` — список **всех** заказов с этого email (включая прошлые guest-заказы из US3-merge). На `/account/profile/` редактируется ФИО, телефон, дефолтный адрес доставки. На `/account/preferences/` — opt-in/opt-out маркетинга, мессенджеров, language preference.

**Why this priority**: возвращающемуся клиенту не нужно каждый раз заполнять форму чекаута — данные подставляются из профиля. Снижает friction на 2-м и далее заказе. Открывает дорогу к B2B-кабинетам (US4) и cart-persistence (052).

**Independent Test**: зарегистрировать `test@example.com`, оформить 2 guest-заказа с этого email до регистрации, потом ещё 1 после — на `/account/orders/` видны все 3 в хронологическом порядке, нет чужих, дефолтный адрес из профиля подставляется в новый чекаут.

**Acceptance Scenarios**:

1. **Given** клиент не зарегистрирован, **When** заходит на `/account/register/` и заполняет форму, **Then** запись в `customers` создаётся с `passwordHash`, `gdprConsentAt = now`, `lastLoginAt = now`, sync-job для Twenty Person с upsert по email.
2. **Given** клиент уже зарегистрирован, **When** заходит на `/account/login/` с верным паролем, **Then** session-cookie выдаётся, redirect на `/account/orders/`.
3. **Given** клиент в `/account/orders/`, **When** список рендерится, **Then** видны Order, где `Order.customerId = me.id` ИЛИ `Order.customer.email = me.email` (для backfill старых заказов), сортировка по `createdAt DESC`.
4. **Given** клиент кликает на конкретный заказ, **When** открывается `/account/orders/[orderId]/`, **Then** видны все поля заказа в read-only, ссылка на трекинг, кнопки «Скачать счёт», «Запросить возврат» (через 053), «Поддержка» (mailto manager).
5. **Given** клиент в `/account/profile/`, **When** меняет ФИО / телефон / адрес и сохраняет, **Then** запись в `customers` обновляется, sync-job к Twenty Person.

---

### User Story 2a — Сброс пароля (Priority: P1)

Customer нажимает «Забыл пароль» на `/account/login/`. AS1: Customer вводит email -> `POST /api/customers/forgot-password` -> email с reset-link (opaque token, TTL 30 мин). AS2: Customer переходит по ссылке -> `POST /api/customers/reset-password?token=X` -> пароль обновлён, все сессии кроме текущей закрыты.

**Why this priority**: без reset-password customer с установленным паролем не сможет восстановить доступ, что вынуждает обращаться к менеджеру и подрывает доверие к self-service. Payload v3 имеет `auth.forgotPassword` API, который можно использовать.

**Acceptance Scenarios**:

1. **Given** клиент с паролем, **When** вводит email на `/account/login/` и нажимает «Забыл пароль», **Then** `POST /api/customers/forgot-password` отправляет email с reset-link (opaque token, TTL 30 мин). Ответ всегда 200 (anti-enumeration).
2. **Given** клиент получил reset-link, **When** переходит по ссылке и вводит новый пароль, **Then** `POST /api/customers/reset-password?token=X` обновляет `passwordHash`, все sessions кроме текущей инвалидируются.
3. **Given** token уже использован или истёк, **When** клиент пытается сбросить пароль, **Then** ответ 410 `RESET_TOKEN_EXPIRED` с предложением запросить новый.

---

### User Story 3 — При входе клиента anonymous-корзина и история гостевых заказов с того же email мигрируют в его аккаунт (Priority: P1)

Сценарий: клиент уже оформил 3 guest-заказа за прошлые месяцы (все на email `vasya@mail.ru`). Сегодня он впервые регистрируется на `/account/register/`. После регистрации сервер выполняет merge: все Order с `customer.email = vasya@mail.ru` И `customerId IS NULL` получают `customerId = vasya.id`. Аналогично — текущая anonymous-корзина (cartId в localStorage) из 052 привязывается к customerId. Никаких чужих писем-уведомлений merge не плодит.

**Why this priority**: без этого регистрация бесполезна — клиент не увидит свою предыдущую историю, и не будет смысла регистрироваться. Решение должно быть автоматическим и идемпотентным.

**Independent Test**: создать 3 guest-Order с email `vasya@mail.ru` (через 047 чекаут), затем зарегистрироваться с тем же email → `/account/orders/` показывает все 3 в течение секунды после первого логина.

**Acceptance Scenarios**:

1. **Given** клиент впервые регистрируется с email `X`, **When** запись в `customers` создана, **Then** транзакционно выполняется `UPDATE orders SET customerId = $new WHERE customer.email = $X AND customerId IS NULL`.
2. **Given** клиент только что зарегистрировался, **When** в localStorage есть `cartId`, **Then** через API `/api/customers/me/merge-cart` cart получает `customerId`; гостевой `cartId` не сбрасывается, только метится. **Note**: при conversion cart->order: если `cart.customerId != null` -> `Order.customerId` наследует. merge-flow (054 T-043) MUST handle case where customer already has active cart (merge by 052 US6 rules).
3. **Given** клиент входит через magic-link (US1), **When** session создана, **Then** merge выполняется идемпотентно (повторный логин не плодит дубликатов).
4. **Given** уже зарегистрированный клиент с историей, **When** через несколько месяцев оформляет ещё один заказ как гость с тем же email (например, забыл что регистрирован), **Then** post-create hook на Order находит `customers` по email и проставляет `customerId` автоматически. Без merge-конфликта.
5. **Given** другой клиент имеет email `X` (collision: однофамилец, прошлый владелец адреса) и пробует зарегистрироваться, **When** email уже занят, **Then** UI просит ввести magic-link/пароль; ручной merge между двумя `customers` записями — только через менеджера в Payload Admin (US6).

---

### User Story 4 — Юрлицо: один Company-аккаунт + несколько Person (контактных лиц с разными ролями) (Priority: P2)

Компания «ООО Промышленные стойки» (ИНН 7708123456) делает регулярные закупки. На стороне Soliton есть запись в `companies`. К ней привязаны три записи в `customers` с `companyId = company.id`:

- **owner** — генеральный директор (видит все Order компании, может приглашать новых Person, управлять Company-профилем).
- **accountant** — бухгалтер (видит документы — счета, акты, УПД — по всем Order компании; не видит SKU и общие суммы по умолчанию, только то что относится к финансам).
- **purchaser** — закупщик (создаёт новые Order, видит свои Order и Order, к которым его явно пригласил owner).

В `/account/company/team/` (доступно только owner) можно пригласить нового члена команды по email. Приглашение приходит на email; принимающий открывает magic-link → автоматически создаётся `customers` запись с `companyId` и нужной ролью.

**Why this priority**: B2B-сегмент — основная маржа Soliton. Без разделения ролей бухгалтер каждый раз пишет менеджеру с просьбой выслать счёт, а закупщик дублирует Order между разными корпоративными email. P2 потому что MVP можно жить без этого (B2C сначала, B2B-роли — следующая фаза).

**Independent Test**: создать `companies` запись + 3 `customers` с разными ролями → owner логинится → видит 5 заказов компании; accountant логинится → видит только финансовые документы тех же 5 заказов; purchaser логинится → видит свой 1 заказ.

**Acceptance Scenarios**:

1. **Given** owner на `/account/company/team/`, **When** вводит email нового члена + роль, **Then** в `customers` создаётся stub-запись с `companyId`, `role`, `inviteToken`, `inviteExpiresAt`, email с magic-link уходит.
2. **Given** приглашённый открывает magic-link, **When** ставит пароль, **Then** stub становится полноценной записью, `gdprConsentAt = now`.
3. **Given** owner залогинен, **When** заходит на `/account/orders/`, **Then** видит все Order, где `Order.companyId = company.id` (независимо от того, кто из Person оформил).
4. **Given** purchaser залогинен, **When** заходит на `/account/orders/`, **Then** видит только Order, где `Order.customerId = purchaser.id`.
5. **Given** accountant залогинен, **When** заходит на `/account/orders/`, **Then** видит все Order компании, но карточка заказа показывает только финансовый блок (документы, оплата, ИНН) без `items[]` и адреса доставки.
6. **Given** owner отзывает доступ accountant, **When** ставит галочку «деактивировать», **Then** `customers.deletedAt = now` (soft delete), сессии accountant инвалидируются.

---

### User Story 5 — Клиент в /account/ редактирует адреса доставки, дефолтный адрес, opt-in/opt-out из 049 (Priority: P2)

В `/account/profile/addresses/` клиент управляет адресной книгой (несколько адресов: «дом», «дача», «работа»). Один помечен как `isDefault`. В чекауте 047 при логине дефолтный адрес подставляется автоматически (с возможностью переключить или ввести новый, который будет предложен сохранить).

В `/account/preferences/` клиент управляет согласиями из 049:

- `marketingOptIn` — рассылки.
- `messengerOptIn` — мессенджеры (placeholder для 050).
- Smart-default — для гостя через magic-link все opt-in выключены (только транзакционные письма).

**Why this priority**: повторная конверсия. Также 152-ФЗ-требование явного opt-in.

**Independent Test**: добавить 2 адреса, отметить второй как default → начать новый чекаут → видеть второй адрес. Снять `marketingOptIn` → запустить cron `marketing-batch` → клиенту письмо не приходит.

**Acceptance Scenarios**:

1. **Given** клиент в `/account/profile/addresses/`, **When** добавляет адрес и сохраняет, **Then** запись в массиве `customers.addresses[]` (или отдельной коллекции `customer-addresses` — см. data-model.md), nullable `customers.defaultAddressId`.
2. **Given** клиент меняет дефолтный адрес, **When** новый адрес помечен default, **Then** старый дефолт снимается, флаг — единственный.
3. **Given** клиент с дефолтным адресом начинает новый чекаут, **When** форма S05 (адрес доставки) рендерится, **Then** поля предзаполнены, есть кнопка «Использовать другой адрес».
4. **Given** клиент снял `marketingOptIn`, **When** запись сохранена, **Then** sync-job обновляет `Person.marketingOptIn` в Twenty, в БД `customers.marketingOptIn = false`.
5. **Given** клиент в `/preferences/[token]/` (из 049 US6) или в `/account/preferences/`, **When** меняет согласия, **Then** изменения применяются к одной и той же записи в `customers`.

---

### User Story 6 — Менеджер в Payload Admin видит карточку Customer со всеми его Orders, Returns, Carts; ссылка на Twenty Person (Priority: P2)

В Payload Admin появляется коллекция `customers` (видна только менеджерам). Открывая карточку клиента, менеджер видит:

- Базовые поля (email, телефон, ФИО, customerType, companyId-ссылка).
- Таблицу заказов (relationTo orders) — все, у которых `customerId = this.id`.
- Таблицу возвратов (relationTo returns, из 053).
- Таблицу корзин (relationTo carts, из 052) — активные и брошенные.
- Ссылку «Открыть в Twenty» (deep link на `Person`).
- Кнопку «Слить с другим Customer» (для разрешения merge-конфликтов из US3.5).
- Кнопку «Экспортировать данные (152-ФЗ)» — генерирует JSON со всеми его данными.
- Кнопку «Удалить по GDPR» — soft delete с каскадом в Twenty.

**Why this priority**: операционная необходимость. Без админ-вью менеджер не сможет отвечать на запросы клиентов «покажите мою историю» / «удалите меня».

**Independent Test**: открыть карточку клиента → таблицы Order/Return/Cart фильтруются по customerId → кнопка «Открыть в Twenty» ведёт в правильную Person → экспорт возвращает валидный JSON.

**Acceptance Scenarios**:

1. **Given** менеджер в Payload Admin, **When** открывает `customers/[id]/`, **Then** видит группу «Orders» с фильтрованным списком (custom field component).
2. **Given** в `customers` есть `companyId`, **When** карточка рендерится, **Then** есть ссылка на родительскую `companies/[companyId]/`.
3. **Given** менеджер кликает «Слить с другим Customer», **When** выбирает целевую запись, **Then** все `orders`/`carts`/`returns` source-записи получают новый `customerId`, source `customers.deletedAt = now`, AdminChangeLog запись.
4. **Given** менеджер кликает «Экспортировать данные», **When** запрос выполнен, **Then** скачивается JSON со всеми персональными данными клиента (см. FR-5440).
5. **Given** менеджер кликает «Удалить по GDPR» с подтверждением, **When** confirm, **Then** `customers.deletedAt = now`, ПДн обнуляются (email → `deleted-{id}@gdpr.local`, phone → null, fullName → «Удалён»), Order.customer.* остаются как snapshot (для бухучёта), запись Twenty Person удаляется каскадно (FR-4807a из 048).

---

### User Story 7 — B2B-кабинет компании: общая корзина, согласование закупки между ролями, лимиты на сумму без апрува (Priority: P3)

> **Note**: поле `approvalLimit` в Companies -- inert до US7 (P3). Не enforce'ится в MVP. Поле присутствует в data-model для forward-compatibility, но логика проверки лимита и approval-flow не реализуется до US7.

Покупательский флоу для серьёзного B2B-клиента:

- Корзина `carts.companyId` — **общая для всех Person компании**. purchaser добавил позиции — accountant видит их в своём `/account/cart/`.
- Если итог корзины ≤ `companies.approvalLimit` (например, 100 000 ₽) — purchaser сам оформляет заказ.
- Если итог > лимита — кнопка «Оформить» меняется на «Запросить апрув у владельца». Owner получает email + видит в `/account/company/approvals/` запрос с deep-link, кликает «Одобрить» → корзина превращается в Order.
- Лимит и список approvers редактируется в `/account/company/settings/`.

**Why this priority**: продвинутый B2B-сценарий, не критичен для MVP. Делается после стабилизации US1–US6.

**Independent Test**: установить approvalLimit=50000, добавить товаров на 75000 → purchaser видит кнопку «Запросить апрув» → owner получает email → одобряет → Order создан.

**Acceptance Scenarios**:

1. **Given** purchaser в `/account/cart/` с итогом ≤ approvalLimit, **When** жмёт «Оформить», **Then** обычный чекаут 047.
2. **Given** purchaser с итогом > approvalLimit, **When** жмёт «Запросить апрув», **Then** создаётся `purchase-approval` запись со статусом `pending`, email к owner.
3. **Given** owner кликает «Одобрить» в email, **When** magic-token валиден, **Then** approval статус = `approved`, purchaser получает email-нотификацию, корзина разблокирована для checkout.
4. **Given** owner отклонил с комментарием, **When** статус = `rejected`, **Then** purchaser видит причину в `/account/cart/`.

---

### Edge Cases

- **Гость с тем же email, что у зарегистрированного**: при guest-checkout НЕ требуем пароль; пишем заказ в БД как обычно, в afterCreate hook ищем `customers` по email — если найден и не deleted, ставим `customerId`; уведомление этому Customer уходит как обычно. Никаких блокеров. Magic-link на email — выдаётся уже зарегистрированному (он войдёт в свой полноценный аккаунт через пароль или magic).
- **Клиент сменил email**: запись в `customers.email` обновляется; **прошлые Order сохраняют `customer.email`** как snapshot (для бухучёта и аудита), но связь через `customerId` сохраняется — на `/account/orders/` все Order по-прежнему видны. Sync к Twenty — `Person.email` обновляется без пересоздания. **Edge Case**: смена email НЕ матчит старые заказы с прежним email автоматически. Если guest-checkout приходит с прежним email после смены -- `FR-5421` (afterCreate hook) не найдёт Customer (т.к. email обновился). Для ретроспективного связывания таких заказов -- manual merge через US6 (admin).
- **Юрлицо не видит личные заказы своего контактного лица (privacy)**: customer с `customerType = company-contact` может оформить заказ как «частное лицо» (например, на свой домашний адрес) — для этого в чекауте есть toggle «Это личный заказ». При активном toggle Order создаётся с `customerId = me.id, companyId = null` — этот заказ owner компании НЕ видит на `/account/orders/`. Только сам Person и менеджер видят такой Order.
- **Soft-delete клиент входит**: если `customers.deletedAt != null`, login отклоняется с сообщением «Аккаунт удалён по запросу субъекта». Чтобы восстановить — обращение к менеджеру.
- **Magic-link токен скомпрометирован (показан другому)**: одноразовый consumption после первого clicke — выдаётся session-cookie, токен помечается `consumedAt`, повторный клик через 30+ минут — `EXPIRED`. Можно ограничить IP / user-agent на первый clicke, но это P3.
- **Backfill старых Order без `customerId`**: при первом логине клиента (через magic-link или register) ищем Order по `customer.email = me.email AND customerId IS NULL` и ставим связь (см. US3). Также есть one-shot скрипт `scripts/backfill-customers.mjs` для разовой миграции на старте 054.
- **Конфликт ИНН между Company-записями**: дедупликация по ИНН (как в FR-4802b 048); если 2 разных `companies` имеют одинаковый ИНН → менеджер в Admin делает merge.
- **Удалённый Customer, у которого есть pending Order**: блокируем deletion до завершения активных заказов (delivered/cancelled — можно; in-transit — отказ с пояснением).
- **Account deletion UX**: после `POST /api/customers/me/delete` -- redirect на homepage. Email подтверждения на old email: «Ваш аккаунт удалён». Отдельный deactivation mode (временное отключение с восстановлением) -- Not Implemented (Out Of Scope).
- **Накопительная скидка / loyalty (out of scope для 054)**: упоминается только как «может быть в будущем». В 054 у Customer нет totals — только история ссылок.

## Requirements *(mandatory)*

### Functional Requirements

#### Сущности и идентификация

- **FR-5401**: System MUST вводить новую Payload collection `customers` с `auth: true` (отдельную от admin Users), полями по data-model.md §1. Коллекция MUST иметь `accountState` enum: `email-only | password-set | invited-stub | deleted`. Merge-flow (US3) и Twenty sync (FR-5446) привязаны к состоянию `password-set` или явному `accountActivated` event. Запись с `accountState = email-only` создаётся при первом magic-link click; переход в `password-set` -- при US1.AS5 или US2.
- **FR-5402**: System MUST вводить новую Payload collection `companies` (без auth), полями по data-model.md §2.
- **FR-5403**: System MUST расширять `orders` полями `customerId` (relationTo customers, nullable) и `companyId` (relationTo companies, nullable). Сохраняется существующая `Order.customer.*` группа как snapshot (immutable после `paid`).
- **FR-5404**: System MUST расширять `carts` (из 052) полями `customerId` и `companyId`.
- **FR-5405**: System MUST расширять `returns` (из 053) полем `customerId`.

#### Аутентификация и сессии

- **FR-5410**: System MUST поддерживать аутентификацию customers по `email + password` (bcrypt cost ≥ 12) — через Payload `auth` API.
- **FR-5411**: System MUST поддерживать magic-link аутентификацию: токен — opaque строка ≥ 32 байта в `customers.magicLinkToken`, TTL = 30 минут, одноразовое consumption (после первого clicke `consumedAt = now`; до этого момента можно открыть в той же сессии). После 30 минут — токен невалиден, выдача новой ссылки через `/account/login?magic=true&email=X`.
- **FR-5412**: System MUST хранить session как HTTP-only cookie `customer_session` с TTL 24 ч (sliding window: каждый запрос продлевает). Используется Payload-default auth-session (не next-auth).
- **FR-5412a**: Customers auth collection MUST использовать explicit cookie name `customer_session` в Payload config:
  ```js
  auth: { cookies: { name: 'customer_session', sameSite: 'Lax', secure: true, domain: process.env.COOKIE_DOMAIN } }
  ```
  Это предотвращает коллизию с admin `payload-token` cookie. Без явного name Payload по умолчанию использует `payload-token` для ВСЕХ auth-collections, что сломает admin-сессию.
- **FR-5413**: System MUST НЕ пересекать customer-сессию и admin-сессию: cookie разные, middleware различает по path (`/account/*` vs `/admin/*`).
- **FR-5414**: System MUST после `order.paid` для guest-заказа автоматически генерировать magic-link и отдавать его в payload `T-001` email-шаблона (через 049 emitter).
- **FR-5415**: System MUST после `order.invoice_issued` для guest-заказа (юрлицо) генерировать magic-link и вкладывать в `T-002`.
- **FR-5416**: System MUST поддерживать rate-limit на endpoint `/api/customers/login` (max 5 попыток / 15 минут / IP) и `/api/customers/magic-request` (max 3 / 15 мин / email).
- **FR-5416a**: `POST /api/customers/register` MUST всегда возвращать 200 с message «check your email». При duplicate email -- отправлять email «вы уже зарегистрированы, войдите» вместо 409. Это предотвращает email enumeration через endpoint регистрации.
- **FR-5417**: CSRF protection обязательна для всех POST/PATCH/DELETE на `/api/customers/*`. Реализация через Payload-native CSRF token или custom double-submit cookie pattern.
- **FR-5418**: На logout очищаются: `customer_session` (обязательно). Сохраняется: `soliton_cart_token` (052, cart остаётся anonymous). localStorage cleanup (e.g. `cartId`) -- UI responsibility.

#### Merge гостевой истории

- **FR-5420**: System MUST при создании новой `customers` записи (register или первый magic-link) транзакционно выполнять backfill: `UPDATE orders SET customerId = $new WHERE customer.email = $email AND customerId IS NULL`. Аналогично для `carts` и `returns`.
- **FR-5421**: System MUST в afterCreate hook на `orders` (для guest-заказов с `customerId IS NULL`) искать `customers` по email и проставлять `customerId` если найден.
- **FR-5422**: System MUST логировать все merge-операции в `AdminChangeLog` с указанием count записей.

#### Профиль и предпочтения

- **FR-5430**: System MUST поддерживать массив `customers.addresses[]` или отдельную коллекцию `customer-addresses` (выбор в research.md) с полями: label, city, fullAddress, postalCode, addressNormalized (DaData), isDefault.
- **FR-5431**: System MUST переносить флаги `marketingOptIn` / `messengerOptIn` с `orders` на `customers` как первоисточник; на `orders` остаётся snapshot на момент создания заказа (для аудита).
- **FR-5431a**: Migration of Preference Fields. После 054 release:
  1. Источник истины: `Customer.marketingOptIn` / `messengerOptIn` / `emailValid` (если customer существует).
  2. `Order.marketingOptIn` -- snapshot на момент создания заказа (audit).
  3. 049 emitter читает: если `Order.customerId != null` -- `Customer.marketingOptIn`; else -- `Order.marketingOptIn` (fallback для guests).
  4. `/preferences/[token]/` после 054: обновляет Customer (если существует) AND Order snapshot.
  5. Bounce handler (049): помечает `Customer.emailValid = false` (не только Order).
  6. При создании Customer -- скопировать `marketingOptIn` из самого последнего Order с этим email.
- **FR-5432**: System MUST синхронизировать изменения `customers.marketingOptIn` / `messengerOptIn` к Twenty Person через очередь 048.
- **FR-5433**: System MUST поддерживать смену email — с email-подтверждением через double opt-in (письмо на новый адрес со ссылкой confirm).
- **FR-5433a**: При `POST /api/customers/me/change-email`: (1) confirm-link на новый email, (2) notification с undo-link на старый email. Окно 72 часа. После change -- все sessions кроме текущей закрыты. Это предотвращает account takeover при украденной сессии.

#### B2B-роли и компания

- **FR-5434**: System MUST поддерживать `customers.companyId` (FK на `companies`) и `customers.role` (`owner | accountant | purchaser | contact`).
- **FR-5435**: System MUST в `/account/orders/` фильтровать показ Order по роли:
  - `owner` — все Order, где `companyId = my.companyId`.
  - `accountant` — все Order, где `companyId = my.companyId`, но карточка показывает только финансовые поля (без items, без shipping address).
  - `purchaser` — только Order, где `customerId = my.id`.
  - `contact` (default) — только свои.
- **FR-5436**: System MUST на странице приглашения `/account/company/team/` (только для owner) позволять создать stub-`customers` запись с пред-задавкой `companyId` и `role`, отправлять magic-link приглашение. **Note**: `inviteToken` и `magicLinkToken` -- два отдельных token-механизма с разными TTL (magic: 30 мин, invite: 7 дней) и разной семантикой (одноразовый вход vs принятие приглашения). Унификация в `customers.tokens[]` -- follow-up.
- **FR-5437**: System MUST поддерживать toggle «личный заказ» в чекауте 047: если включён -> новый Order создаётся с `customerId = me.id, companyId = null`; иначе для company-contact -- наследует `companyId = me.companyId`. Toggle (FR-5437) -- additive component, показывается ТОЛЬКО для logged-in company contacts. 047 spec НЕ меняется; toggle живёт в новом компоненте `PersonalOrderToggle.tsx`, вставленном в `PhysicalCheckoutForm` при наличии active customer session.

#### Privacy и compliance

- **FR-5440**: System MUST реализовать endpoint `GET /api/customers/me/export` (требует customer-сессии) — отдаёт JSON со всеми ПДн клиента: customer-record, addresses[], orders[] (только metadata, не вложения), returns[], carts[]. Скачивается как `soliton-export-{customerId}-{date}.json`.
- **FR-5441**: System MUST реализовать endpoint `POST /api/customers/me/delete` (требует подтверждения паролем или magic-token) — soft delete: `deletedAt = now`, ПДн обнуляются (email -> `deleted-{id}@gdpr.local`, phone -> null, addresses -> []), Order.customer.* остаются как immutable snapshot, в Twenty Person удаляется каскадно через 048. Явные таблицы анонимизируемых vs сохраняемых полей -- см. data-model.md §11 (GDPR Anonymization Table).
- **FR-5442**: System MUST блокировать `DELETE` запросы, если у customers есть активные Order (status ∈ `pending_payment | paid | fulfilling | shipped`). Ответ 409 `ORDERS_IN_PROGRESS`.
- **FR-5443**: System MUST в payload-admin для менеджера предоставлять кнопки «Экспорт» и «Удалить по GDPR» с теми же контрактами.
- **FR-5444**: System MUST хранить `customers.gdprConsentAt` (timestamp согласия на обработку ПДн), `customers.gdprConsentVersion` (для отслеживания версий privacy policy).
- **FR-5445**: System MUST реализовать privacy-фильтр: `accountant` НЕ видит `Order.delivery.address`, `Order.items[]`; `purchaser` НЕ видит чужие Order своей компании; контакт-лицо НЕ видит личные заказы коллег (даже owner не видит личные заказы своего accountant'а).
- **FR-5445a**: Privacy enforcement MUST быть на API level, не только UI. Для accountant role: field-level access на Orders ограничивает `items[]` и `delivery.address` поля (Payload `read` field-level access или server-mapper в `/api/customers/me/orders`). Тест T-111 ДОЛЖЕН проверять API-response, а не UI-rendering.

#### Twenty CRM sync

- **FR-5446**: System MUST при создании/обновлении `customers` ставить sync-job (через очередь 048): upsert Twenty `Person` по email. Маппинг: `firstName, lastName, email, phones[0], marketingOptIn`.
- **FR-5446a**: При первом sync Customer -> Twenty Person: проверить existence Person в Twenty по email перед create. Если найден -- upsert (взять existing id), записать `crmPersonId` в Customer. Это предотвращает дубликаты Person в Twenty для клиентов, чьи Person были ранее созданы через 048 из Order.customer.email.
- **FR-5447**: System MUST при создании/обновлении `companies` ставить sync-job: upsert Twenty `Company` по taxId (ИНН). Маппинг: `name, taxId, kpp, ogrn, legalAddress`.
- **FR-5448**: System MUST хранить `customers.crmPersonId`, `companies.crmCompanyId` после успешного upsert.
- **FR-5449**: System MUST при soft-delete клиента (US6 / FR-5441) ставить cascade-delete job на Twenty Person (FR-4807a из 048).
- **FR-5450**: System MUST синхронизировать обновления Person/Company **из** Twenty (при ручном изменении менеджером) обратно в `customers`/`companies` через webhook 048 US5; conflict-resolution: last-write-wins по `updatedAt`.
- **FR-5450a**: Inbound Person/Company webhooks из Twenty -- **deferred до 048 Phase 2**. FR-5450 требует расширения 048 webhook handler (`/api/webhooks/twenty`) для приёма `Person.updated` / `Company.updated` payloads. До 048 Phase 2: unidirectional sync only (Soliton -> Twenty). Tie-breaker для last-write-wins: если оба обновлены в течение 5s, Soliton wins.

### Key Entities

- **Payload collection `customers`** (auth=true) — см. data-model.md §1.
- **Payload collection `companies`** — см. data-model.md §2.
- **Расширение `orders`**: `customerId`, `companyId`, immutable snapshot `customer.*`.
- **Расширение `carts`** (от 052) и `returns` (от 053): `customerId`, `companyId`.
- **Опциональная коллекция `customer-addresses`** или массив на customers (см. data-model.md §3, решение в research.md).
- **Опциональная коллекция `purchase-approvals`** (US7, отложено).

## Success Criteria *(mandatory)*

- **SC-001**: 100% guest-заказов с валидным email получают рабочий magic-link в первом transactional email (T-001/T-002), доля кликов на magic-link ≥ 40% в первый месяц.
- **SC-002**: Доля повторных заказов от зарегистрированных клиентов ≥ 25% (через 6 месяцев после релиза) — измеряем по dataLayer-событию `repeat_purchase`.
- **SC-003**: Среднее время оформления повторного заказа залогиненного клиента ≤ 2 минут (vs ~5 минут для гостя в 047).
- **SC-004**: ≤ 1% merge-конфликтов при autobackfill (требуют ручного вмешательства менеджера) от общего числа регистраций.
- **SC-005**: 100% GDPR-запросов (`/api/customers/me/export` и `/api/customers/me/delete`) обрабатываются за ≤ 30 секунд; экспорт-JSON покрывает все таблицы из FR-5440.
- **SC-006**: 0 утечек ПДн между Customer'ами одной компании (privacy-фильтр FR-5445 — покрыт автотестом, проверяется в CI).
- **SC-007**: 100% изменений `customers` синхронизированы с Twenty Person в течение 15 минут (через очередь 048).
- **SC-008**: 0 случаев потери истории заказов при смене email клиента (заказы остаются доступны под новым логином).

## Sprint Estimation (D3)

Реалистичная разбивка (вместо оптимистичных «1-2 спринта» в plan.md):
- **Sprint 1 (10 дней)**: Setup + Foundational + US1 + US2 + US2a + US3 = MVP B2C.
- **Sprint 2 (10 дней)**: US5 + US6 + GDPR + Twenty sync + Backfill = admin + 152-ФЗ.
- **Sprint 3 (5-10 дней)**: US4 (B2B-роли) + Security audit + Polish.
- **Sprint 4**: US7 (approval flow) -- отдельно, P3.

## Assumptions

- Payload v3 поддерживает несколько auth-collections в одном проекте (admin Users + customer Customers) — подтверждается в research.md.
- Email-провайдер из 049 (Postmark/Mailgun) умеет отправлять magic-link письма с low-latency (SLA ≤ 1 мин — FR-049-SC001).
- Twenty Person/Company custom fields из 048 (`taxId`, `marketingOptIn`) уже мигрированы через `crm:migrate-fields`. Иначе — добавляются в `contracts/twenty-fields.md` 048 как зависимость 054.
- 052 и 053 ещё в разработке — 054 реализуется параллельно, контракты согласованы.
- ИНН валидный (формальный чек: 10 или 12 цифр + контрольная сумма) — отдельный валидатор; для гостей оставляем как сейчас (свободный ввод).
- Pretty URLs в Cyrillic-routing не требуются для `/account/*` — латиница: `/account/orders/`, `/account/profile/`, `/account/magic/[token]/`.

## Out Of Scope

- **Social login (Google/Yandex/VK)** — отдельная спека 055+, если будет спрос.
- **Loyalty programs (бонусы, кешбэк, накопительные скидки)** — отдельная спека после стабилизации 054.
- **Multi-tenant** (несколько компаний на одного Person) — в 054 один Person привязан к одной Company.
- **SSO для крупных клиентов (SAML / OIDC)** — после MVP, если будет крупный enterprise.
- **Push-уведомления / PWA-installable account dashboard** — отдельная спека.
- **Telegram-канал в /account/preferences/** — после релиза 050.
- **Двухфакторная аутентификация (2FA)** — для admin Users есть в Payload, для customers — отдельная спека 056+.
- **Public API для интеграции с ERP клиента** — отдельная спека.

## Trace To Roadmap & Documents

- `07-build-specifications/order-lifecycle-spec.md §4` — маппинг Person/Company в Twenty (вход).
- `specs/047-delivery-checkout-apiship/spec.md` — guest-checkout (источник Order.customer.*).
- `specs/048-twenty-crm-sync/spec.md` — Twenty Person/Company sync (двусторонне после 054).
- `specs/049-customer-notifications/spec.md` — magic-link email (T-001/T-002 расширяются).
- `specs/052-cart-as-entity/spec.md` — carts.customerId (forward-reference).
- `specs/053-returns-and-refunds/spec.md` — returns.customerId (forward-reference).
- `07-build-specifications/document-register.md` — раздел 7 (Customer account).

## Research Decisions

### RD-1: Magic-link Architecture (A1, Q4 resolved)

Magic-token = opaque random 256-bit, хранится в БД (`customers.magicLinkToken`) с `consumedAt`. НЕ JWT.

После consumption magic-link выдаёт Payload-native session cookie (JWT under the hood -- деталь Payload), TTL 24h sliding window.

Cookie name MUST be `customer_session` (NOT default `payload-token`). См. FR-5412a.

Refresh-token не используется -- sliding window на основной cookie достаточен.

`CUSTOMER_MAGIC_SECRET` env var НЕ нужен для opaque tokens (magic-link не подписываются). Если потребуется HMAC-подпись restore-links -- repurpose.

`magicLinkRequestedFromIp` -- audit-only поле, не используется для policy enforcement.

## Open Questions

| # | Вопрос | Кому |
|---|---|---|
| Q1 | Используем Payload-default auth или next-auth? Рекомендация — Payload (см. plan.md) | архитектура |
| Q2 | Адреса — массив на customers или отдельная коллекция `customer-addresses`? | архитектура |
| Q3 | Email confirmation при регистрации — обязательное или опциональное? Рекомендация — опциональное (double opt-in only для смены email и маркетинговых рассылок) | продукт |
| ~~Q4~~ | ~~Magic-link TTL~~ — **Resolved в RD-1**: 30 мин для token, 24 ч sliding session cookie после consumption. | ~~продукт/security~~ |
| Q5 | B2B-роли — фиксированный список из 4 (owner/accountant/purchaser/contact) или динамические permissions? Рекомендация — фиксированный для MVP | продукт |
| Q6 | Approval flow (US7) — в 054 или отдельная 055? Рекомендация — отдельная | менеджмент |
| Q7 | Что делать со старыми Order, где `customer.email` пустой (RFQ-формы)? Backfill пропускает или создаёт Customer-stub? Рекомендация — пропускает | данные |
| Q8 | Soft-deleted Customer — обнуляем все ПДн сразу или храним 30 дней для возможности восстановления? Рекомендация — обнуляем сразу, никаких grace-period | юр/security |
| Q9 | Customer в Payload Admin — отдельная collection в боковом меню или вложенная в Sales? | UX-админ |
