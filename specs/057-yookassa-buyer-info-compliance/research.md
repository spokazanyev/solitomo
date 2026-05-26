# Research: 057 ЮKassa Buyer-Info Compliance

**Phase 0** — архитектурные решения и обоснования. Все NEEDS CLARIFICATION из `plan.md` Technical Context разрешены через clarify-ответы (Q1-Q5) либо через ниже описанные decisions.

---

## R1. Хранение контента buyer-info страниц

**Решение:** Новая Payload-коллекция `static-pages` с rich-text body и поддержкой версионирования.

**Обоснование:**
- Изолированный домен (buyer-info ≠ product docs ≠ knowledge articles)
- Versioning из коробки Payload (`versions: { drafts: true, maxPerDoc: 50 }`) закрывает FR-5741
- Доступ Owner'a через админ-панель без миграции — FR-5740
- Slug-based routing `app/(site)/info/[slug]/page.tsx` повторяет паттерн `/company/[slug]/`
- Не смешиваем `documents` (PDF-паспорта, сертификаты для тендеров — другая семантика)

**Альтернативы рассмотрены:**
- *Расширение `documents`*: отвергнуто — там `document_type` для product/datasheet/cert, мешает domain. Конфликт по `indexing_policy`
- *MDX-файлы в `content/`*: отвергнуто — Owner не может править без деплоя (нарушение FR-5740)
- *Hard-coded React-компоненты*: отвергнуто — то же

**Ссылки:** Payload v3 versions docs, паттерн в существующих `RfqRequests`, `Documents`

---

## R2. Хранение факта согласия (ConsentRecord)

**Решение:** Embedded group `consent` в каждой целевой коллекции — закреплено в `/clarify` Q2.

**Структура группы (одинаковая для всех 4 коллекций):**
```typescript
{
  consentedAt: string;       // ISO 8601
  policyVersionPrivacy: string;  // например, "2026-05-25-v1"
  policyVersionOffer: string;
  ipHash: string;            // sha256(IP), как Cart.ipHash в 052
  userAgent?: string;        // ≤ 200 chars (паттерн 052)
}
```

**Целевые коллекции:** `Orders`, `Carts`, `Customers`, `RfqRequests`

**Не добавляется в:**
- `Returns` — согласие даётся **один раз** в Order/Customer на этапе покупки, при создании возврата отдельное согласие не требуется (это уже постпродажная операция в рамках существующего договора)

**Обоснование:**
- Локальность данных (один SELECT отдаёт заказ + согласие)
- Каскадный GDPR delete (`payload.delete(customer)` удаляет согласие)
- Не нужна отдельная коллекция + админ-страница + миграция для `consent-log`
- В случае запроса Роскомнадзора (SC-009) — `WHERE consentedAt BETWEEN ...` по каждой целевой коллекции даёт ответ за минуты

**Альтернативы:**
- *Отдельная коллекция `consent-log`*: отвергнуто (Q2 в clarify) — добавляет миграцию, админ-UI, риск рассинхронизации
- *Гибрид*: отвергнуто как избыточное усложнение

---

## R3. Версионирование политик и форма checkbox-текста

**Решение:** Версия политики — линейная строка `YYYY-MM-DD-vN` (например, `2026-05-25-v1`). Хранится в поле `version` на каждом `static-page` юр-документа. При записи в `consent.policyVersionPrivacy/Offer` берётся текущая `version` из published draft `static-pages` соответствующего slug.

**Технические детали:**
- Старые согласия валидны на свою версию (никаких ретроактивных пересогласий)
- При обновлении политики Owner обязан заполнить новые `version` + `effectiveFrom` (FR-5719)
- Checkbox-текст всегда **один и тот же**: «Согласен с [офертой](info/offer/) и [политикой обработки ПДн](info/pd-policy/)» — независимо от версии (политика по сути одна, версии — её редакции)

**Server-side при submit формы:**
```typescript
// pseudo-code
const offerPage = await payload.find({ collection: 'static-pages', where: { slug: 'offer' }, limit: 1 });
const privacyPage = await payload.find({ collection: 'static-pages', where: { slug: 'pd-policy' }, limit: 1 });
const consent = {
  consentedAt: new Date().toISOString(),
  policyVersionOffer: offerPage.docs[0]?.version ?? 'unknown',
  policyVersionPrivacy: privacyPage.docs[0]?.version ?? 'unknown',
  ipHash: sha256(req.ip).slice(0, 32),
  userAgent: req.headers['user-agent']?.slice(0, 200),
};
```

---

## R4. Cookies-banner — техническая реализация

**Решение:** No-SSR client-side компонент `<CookieConsentBanner>` + analytics-loader на отдельном lifecycle hook.

**Паттерн:**
1. `RootLayout` рендерит `<CookieConsentBanner />` без `next/script` для GA/Метрики
2. `CookieConsentBanner` (client component) на mount:
   - Читает `document.cookie` для `cookie_consent`
   - Если нет — показывает баннер
   - Если `accepted` — вызывает `loadAnalytics()` 
   - Если `declined` — ничего
3. `loadAnalytics()` инъектирует `<script>` теги программно (`document.head.appendChild`) — паттерн обходит NextJS SSR полностью
4. Кнопка «Управление cookies» в footer открывает повторно тот же баннер (re-prompt) для смены решения

**Почему не `next/script` через `strategy="lazyOnload"`:** даже `lazyOnload` подгружает скрипт, как только идёт idle. Нам нужна **программная блокировка** до явного opt-in.

**Cookie-параметры:**
- Name: `cookie_consent`
- Value: `accepted` | `declined`
- Max-Age: `31536000` (365 дней)
- Path: `/`
- SameSite: `Lax`
- Secure: `true` (только https)
- HttpOnly: `false` (нужен доступ из JS)

**Server detection:** middleware `apps/web/middleware.ts` (если есть) или просто RSC `cookies()` API — если cookie уже стоит, не рендерим placeholder для баннера, чтобы избежать CLS

**Ответственное расположение трекеров:**
- `apps/web/src/lib/analytics/analytics-loader.ts` — загружает GA4 + Метрику программно
- `apps/web/src/lib/analytics/cookie-consent.ts` — read/write `cookie_consent`
- Существующие dataLayer-вызовы (`purchase`, `add_to_cart`) — продолжают пушить в `window.dataLayer`, но если аналитика не загружена, события буферизуются (`window.dataLayer.push` всё равно работает, скрипт прочитает буфер после загрузки)

---

## R5. Источники текстов — глубинный анализ shop.nag.ru

**Решение:** Claude генерирует первичные черновики на основе обработанных текстов с shop.nag.ru + типовых формулировок 152-ФЗ/ГК/ЗоЗПП. Шаблоны лежат в `contracts/content-templates/*.md` для каждой страницы. Owner финализирует через админ-панель.

**Адаптация под Solitomo:**
- Юр.лицо: ООО «НПП Солитон-1» (вместо ООО «НАГ»)
- ИНН: 6659009140, ОГРН: 1026602965850, КПП: 667801001
- Юр.адрес: 620034, г. Екатеринбург, ул. Колмогорова, д. 54а, кв. 54
- Факт.адрес сервиса: г. Екатеринбург, ул. Щорса, д. 7, корпус Р
- Ответственный по ПДн: Директор Показаньев Виктор Григорьевич
- Email: soliton@soliton1.ru
- Гарантия: 12 мес (из Q3)
- Подсудность: Арбитражный суд Свердловской обл. (для юрлиц), районный суд по месту регистрации потребителя (для физлиц)
- Доставка: ApiShip-провайдеры (СДЭК, Boxberry, Russian Post, ТК) — из 047, плюс самовывоз Екатеринбург
- Оплата: ЮKassa (карты МИР/Visa/Mastercard, СБП) + банковский перевод (для юрлиц)

**B2B-адаптация** (отличия от B2C-сайта NAG):
- В оферте — отдельный блок «RFQ-flow»: создание заказа = акцепт оферты + согласование КП
- В возврате — для юрлиц обязательны акты (053 кредит-нота)
- На FAQ — «Можно ли заказать без регистрации?» (YES, gosth-checkout работает)
- На /info/payment/ — упор на счёт + банковский перевод как ОСНОВНОЙ метод для юрлиц

**Шаблоны** (готовятся в Phase 1 в `contracts/content-templates/`):
- `offer.md` — на основе ГК ст. 432-435 + структура shop.nag.ru /polzovatelskoe-soglashenie
- `privacy.md` — на основе 152-ФЗ ст. 18-19 + структура shop.nag.ru /privacy_policy
- `pd-policy.md` — на основе 152-ФЗ + ПП-1119 + структура shop.nag.ru /personal-data-processing-policy
- `terms.md` — пользовательское соглашение по образцу shop.nag.ru
- `warranty.md` — наша специфика 12 мес + ГК + структура shop.nag.ru /warranty
- `payment.md` — наша 055 ЮKassa специфика + СБП + 54-ФЗ
- `delivery.md` — наша 047 ApiShip
- `return.md` — наша 053 returns + ЗоЗПП ст. 26.1/22
- `faq.md` — топ-8 вопросов B2B-PDU

---

## R6. SEO для buyer-info страниц

**Решение:** Все 9 страниц `/info/*` регистрируются в `seo-registry.ts` как новая секция `info` (по аналогии с `company`).

**Per-page metadata:**
- `title`: «[Заголовок] — Солитон» (например, «Способы оплаты — Солитон»)
- `description`: 140-160 знаков, описание раздела
- `canonical`: `https://pdumarket.ru/info/[slug]/`
- `indexingPolicy`: `index, follow` для всех (FR-5705)
- `schema.org`: `WebPage` для основных, `FAQPage` для `/info/faq/`, `Article` с `dateModified` для юр-документов

**SEO-registry изменения:**
```typescript
// добавить тип
type Section = "main" | "catalog" | "solutions" | "company" | "knowledge" | "b2b" | "documents" | "info";

// добавить 9 routes:
{ path: "/info/payment/", type: "info", title: "Способы оплаты", description: "..." },
{ path: "/info/delivery/", type: "info", title: "Доставка", description: "..." },
...
```

---

## R7. Footer и payment-logos

**Решение:** Существующий `SiteFooter` (`apps/web/src/components/layout/SiteFooter.tsx`) расширяется блоком «Реквизиты + Политики + Payment systems».

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ [Логотип] Описание + телефон + email                         │
│                                                              │
│ Каталог       Покупателям     Компания      Документы        │
│   ↓             ↓               ↓             ↓              │
│   …             Оплата          О нас         Каталог        │
│                 Доставка        Контакты      документов     │
│                 Возврат                                      │
│                 Гарантия                                     │
│                 Оферта                                       │
│                 FAQ                                          │
│                                                              │
│ Платёжные системы: [МИР] [Visa] [Mastercard] [СБП]           │
│                                                              │
│ © 2026 ООО «НПП Солитон-1» | ИНН 6659009140 | ОГРН 1026602965850 │
│ Публичная оферта · Политика конфиденциальности ·             │
│ Политика обработки ПДн · Пользовательское соглашение ·       │
│ Управление cookies                                           │
└──────────────────────────────────────────────────────────────┘
```

**Payment logos:**
- Источник: брендбуки МИР (`nspk.ru`), Visa (`visa.com/brand`), Mastercard (`mastercard.com/brandcenter`), СБП (`sbp.nspk.ru`)
- Формат: inline SVG (для DPR/dark-mode) или PNG ≤ 4KB каждая
- Расположение: `apps/web/public/payment-logos/{mir,visa,mastercard,sbp}.svg`
- Alt: «Платёжная система МИР» / «Visa» / «Mastercard» / «Система быстрых платежей»

---

## R8. Расширение `/company/contacts/` блоком банковских реквизитов

**Решение:** Шаблон страницы `apps/web/src/components/SeoLandingPage.tsx` уже рендерит `/company/contacts/` через SEO-registry. Добавляем поверх RSC-компонент `<BankingDetails>`, который читает данные из `getCompanyContacts()` и рендерит блок.

**Возможные пути:**
1. **Inline в template-content.ts** — добавить sections для `/company/contacts/`. Хорошо для текущей архитектуры
2. **Отдельный компонент `<BankingDetails>`** в `components/company/` — лучше для testability и переиспользования (в счёт PDF)

**Рекомендуется вариант 2:** компонент берёт `banking`, `director`, `okpo`, `okonh` из `getCompanyContacts()` и рендерит блок. Импортируется в `SeoLandingPage` через условный rendering для `route.path === '/company/contacts/'`, либо лучше — через специальный hook `route.contactsExtra: true` в registry.

**Шаблон блока:**
```
┌─ Банковские реквизиты ─────────────────────────────┐
│ Банк: Филиал «Екатеринбургский» АО «АЛЬФА-БАНК»   │
│ БИК: 046577964                                     │
│ К/с: 30101810100000000964                          │
│ Р/с: 40702810638030009466                          │
└────────────────────────────────────────────────────┘

┌─ Руководитель ─────────────────────────────────────┐
│ Директор Показаньев Виктор Григорьевич             │
│ с 29.11.2002                                       │
└────────────────────────────────────────────────────┘

┌─ Дополнительные реквизиты ─────────────────────────┐
│ ОКПО: 25939942                                     │
│ ОКОНХ: 95120                                       │
│ Основной ОКВЭД: 72.19.9 — Научные исследования     │
└────────────────────────────────────────────────────┘
```

---

## R9. Меню «Покупателям» в Header

**Решение:** Расширить `SiteHeader.tsx` пунктом-dropdown'ом «Покупателям» между «Документы» и «Компания».

**Desktop (>768px):** Hover-dropdown, 6 ссылок столбиком
**Mobile (≤768px):** Аккордеон в Mobile menu, раскрывается на тап

**Структура:**
```typescript
const buyerInfoLinks = [
  { href: "/info/payment/", label: "Оплата" },
  { href: "/info/delivery/", label: "Доставка" },
  { href: "/info/return/", label: "Возврат" },
  { href: "/info/warranty/", label: "Гарантия" },
  { href: "/info/offer/", label: "Оферта" },
  { href: "/info/faq/", label: "FAQ" },
];
```

Семантика: `<nav aria-label="Покупателям">` + ul/li для accessibility.

---

## R10. ConsentCheckbox — единый компонент

**Решение:** Shared client-component `<ConsentCheckbox>` в `components/consent/`.

**Props:**
```typescript
type ConsentCheckboxProps = {
  required: boolean;       // всегда true для checkout/RFQ
  value: boolean;
  onChange: (v: boolean) => void;
  className?: string;
  label?: React.ReactNode; // дефолт — стандартный текст
};
```

**Дефолтный label:**
```jsx
<>
  Я согласен с{" "}
  <Link href="/info/offer/" target="_blank">офертой</Link>
  {" "}и{" "}
  <Link href="/info/pd-policy/" target="_blank">политикой обработки персональных данных</Link>
</>
```

**Использование в формах:**
- `apps/web/src/app/(site)/cart/checkout/physical/review/PhysicalCheckoutForm.tsx` (или текущий form-компонент)
- `apps/web/src/app/(site)/cart/checkout/invoice/` (если есть форма)
- `apps/web/src/app/(site)/cart/checkout/quote/`
- `apps/web/src/app/(site)/b2b/request-quote/RfqForm.tsx` (или текущий)
- `apps/web/src/app/(site)/me/register/` (если страница есть в 054)

**Submit-блокировка:** parent-форма передаёт `value` через state, делает submit disabled если `!value && required`.

**Server-side validation:** На POST /api/orders, /api/cart, /api/rfq — проверка `body.consent === true`, иначе 400 Bad Request. Дополнительно сервер генерирует `consent` group (R3 формат) и пишет в БД.

---

## R11. Server-side helpers для consent

**Решение:** Утилита `lib/consent/make-consent-record.ts`:

```typescript
// pseudo-code
import { createHash } from 'crypto';
import configPromise from '@payload-config';
import { getPayload } from 'payload';

export async function makeConsentRecord(req: NextRequest): Promise<ConsentRecord> {
  const payload = await getPayload({ config: configPromise });
  const offerPage = await payload.find({ collection: 'static-pages', where: { slug: { equals: 'offer' } }, limit: 1 });
  const privacyPage = await payload.find({ collection: 'static-pages', where: { slug: { equals: 'pd-policy' } }, limit: 1 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown';
  return {
    consentedAt: new Date().toISOString(),
    policyVersionOffer: (offerPage.docs[0] as any)?.version ?? 'unknown',
    policyVersionPrivacy: (privacyPage.docs[0] as any)?.version ?? 'unknown',
    ipHash: createHash('sha256').update(ip).digest('hex').slice(0, 32),
    userAgent: req.headers.get('user-agent')?.slice(0, 200),
  };
}
```

Каждый API-endpoint (POST /api/orders, /api/cart/[token], /api/rfq, /api/customers/register) — вызывает `makeConsentRecord(req)` и кладёт result в `data.consent`.

---

## R12. Schema.org для юр-документов и FAQ

**Решение:** На `/info/faq/` — `FAQPage` JSON-LD, на остальных `/info/*` — `WebPage` (с `dateModified` от Payload `effectiveFrom`).

**`/info/faq/`:**
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Можно ли заказать без регистрации?",
      "acceptedAnswer": { "@type": "Answer", "text": "..." }
    }
  ]
}
```

**`/info/offer/` и юр-документы:**
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Публичная оферта",
  "datePublished": "<effectiveFrom>",
  "dateModified": "<updatedAt>",
  "publisher": { "@type": "Organization", "name": "ООО «НПП Солитон-1»" }
}
```

Utility: расширить `apps/web/src/lib/seo/structured-data.ts` функциями `getFAQPageJsonLd(items)` и `getArticleJsonLd(page)`.

---

## R13. Тестирование

**Решение:** 3-уровневая стратегия:

1. **Unit (Vitest):**
   - `make-consent-record.test.ts` — sha256-hash, длина userAgent
   - `cookie-consent.test.ts` — read/write cookie, parse значения
   - `analytics-loader.test.ts` — mock document.head.appendChild, проверка script src
   - `get-company-contacts.test.ts` — расширения для banking/director (если есть новые getters)

2. **Integration (Vitest + Payload local API):**
   - `static-pages.test.ts` — CRUD через payload.create/find, version increment
   - `consent-record.test.ts` — создание Order с consent, чтение из payload.findByID

3. **E2E (Playwright):**
   - `info-pages.spec.ts` — все 9 `/info/*` отдают 200, содержат заголовок и core-секции (US1)
   - `consent-checkbox.spec.ts` — submit disabled без галки, при submit consent в БД (US4)
   - `cookie-banner.spec.ts` — incognito → банер виден → до клика нет запросов к GA → после accept аналитика грузится (US6)
   - `footer-policies.spec.ts` — ссылки footer работают на homepage, product page, cart, info-page (US1.2)
   - `company-contacts.spec.ts` — банковские реквизиты + директор отображаются (US3)

**Запуск:** `pnpm test` (existing), `pnpm --filter @soliton/web test:e2e` (новый script добавляется в `/tasks`).

---

## Резюме research.md

| ID | Решение | Файлы для создания/изменения |
|---|---|---|
| R1 | Payload-коллекция `static-pages` с versioning | `collections/StaticPages.ts` (new) |
| R2 | Embedded `consent` group в Orders/Carts/Customers/RfqRequests | 4 collection patches |
| R3 | Версионирование политик `YYYY-MM-DD-vN`, проверка из БД на server side | `make-consent-record.ts` |
| R4 | No-SSR cookies-banner + программная загрузка аналитики | `CookieConsentBanner.tsx`, `analytics-loader.ts` |
| R5 | Тексты юр-документов — Claude генерирует из shop.nag.ru шаблонов, Owner финализирует | `contracts/content-templates/*.md` (9 files) |
| R6 | SEO-registry добавляет 9 routes под type `info` | `seo-registry.ts` patch |
| R7 | Footer расширяется реквизитами + policy links + payment-logos | `SiteFooter.tsx` patch, `public/payment-logos/*.svg` |
| R8 | `/company/contacts/` расширяется блоком banking/director через `<BankingDetails>` | `BankingDetails.tsx` (new) |
| R9 | Меню «Покупателям» в Header (desktop dropdown + mobile accordion) | `SiteHeader.tsx` patch |
| R10 | `<ConsentCheckbox>` shared client-component | `ConsentCheckbox.tsx` (new) |
| R11 | Server-side `makeConsentRecord(req)` helper | `make-consent-record.ts` |
| R12 | FAQPage/Article JSON-LD на /info/faq/ и юр-документах | `structured-data.ts` extension |
| R13 | Unit + Integration + Playwright e2e | новые тесты в `__tests__/` |

**Все NEEDS CLARIFICATION разрешены.** Готово к Phase 1 (data-model + contracts + quickstart).
