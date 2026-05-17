# Feature Specification: Yandex Business + Brand Presence

**Feature Branch**: `041-yandex-business-and-brand-presence`

**Created**: 2026-05-17

**Status**: Deferred (отложено до приоритизации — см. `07-build-specifications/deferred-content-track.md`)

**Input**: Для российской B2B-аудитории основной AI-канал — **Алиса / Яндекс Нейро / Яндекс с AI**. Они черпают данные **в первую очередь** из Yandex Business (карточка организации в Картах/Поиске) и официальных регистров. Без присутствия там — невидимы для российского AI. Дополнительно: для подтверждения существования бренда международным LLM нужна Wikidata-запись и `sameAs` ссылки.

## User Scenarios & Testing

### User Story 1 — Карточка Yandex Business сообщает Алисе о Солитоне (Priority: P1)

Пользователь спрашивает Алису «кто производит PDU в России» — Алиса находит в Yandex Business карточку «Солитон, производитель электротехники» и рекомендует.

**Independent Test (organisational)**: Карточка Yandex Business зарегистрирована и подтверждена; в search "Солитон производитель PDU" она появляется в Yandex Knowledge Card.

**Acceptance**:
1. Зарегистрирована карточка Yandex Business.
2. В карточке указан адрес сайта `https://soliton.ru` (когда домен будет настроен), категория «Электротехническое оборудование» или ближе.
3. Загружены: лого, описание, контакты, фото производства.

### User Story 2 — Wikidata знает о бренде Солитон (Priority: P2)

LLM, при вопросе про производителей PDU в России, через Wikidata находит entity для «Солитон (российский производитель PDU)» и подтверждает существование. Это снижает галлюцинации.

**Independent Test**: На Wikidata.org поиск «Soliton PDU» возвращает страницу с базовой инфой и ссылкой на сайт.

**Acceptance**:
1. Создан Wikidata item с минимальным набором: instance of «business», country «Россия», website, industry «manufacturer of electrical equipment».
2. У ItemID есть инстанс claims, заполнены sitelinks.

### User Story 3 — Organization JSON-LD ссылается на проверяемые источники (Priority: P1)

В Organization schema на сайте поле `sameAs` ссылается на проверяемые внешние ресурсы: Yandex Business (URL карточки), Wikidata (URL item'а), карточка на маркетплейсе если есть, ОФД/Минпромторг реестр.

**Acceptance**:
1. `curl / | grep sameAs` — массив URL.
2. Каждый URL живой, ведёт на профиль Солитон.

### User Story 4 — IndexNow быстро доставляет новые страницы (Priority: P2)

При публикации/обновлении страницы Yandex и Bing узнают о ней через [IndexNow](https://www.indexnow.org) в течение минут, а не дней. Это важно для свежести AI-индекса.

**Acceptance**: POST `https://yandex.com/indexnow` с URL новой страницы возвращает 200/202.

### Edge Cases

- **Yandex Business требует подтверждения**: верификация по телефону/email. Это organisational, не блокирует код.
- **Wikidata модерация**: страница может быть удалена как «недостоверная» если нет внешних источников. Решение: сначала добавить пресс-релиз или статью в отраслевом издании, затем Wikidata.
- **IndexNow ключ**: размещение `<key>.txt` файла в корне с подтверждающим токеном.

## Requirements

### Functional Requirements (код)

- **FR-001**: `createOrganizationJsonLd()` MUST поддерживать массив `sameAs` URLs из `00-source-data/company/contacts.json` (поле `socials[]` + новое поле `externalProfiles[]`).
- **FR-002**: Создать endpoint `/[indexnow-key].txt` который отдаёт верификационный токен IndexNow.
- **FR-003**: Создать helper `apps/web/src/lib/seo/notify-indexnow.ts` — функция `notifyIndexNow(urls[])`, посылающая POST на yandex.com/indexnow и bing.com/indexnow.
- **FR-004**: Hook в Payload `Orders` / `Products` (если будут публиковаться) — на publish вызвать `notifyIndexNow([url])`.

### Organisational Requirements (не код)

- **OR-001**: Зарегистрировать Солитон в Yandex Business.
- **OR-002**: Создать Wikidata item.
- **OR-003**: Получить IndexNow ключ.
- **OR-004**: Расположить логотип, фото производства, описание на странице Yandex Business.

## Success Criteria

- **SC-001**: Алиса по запросу «производитель PDU Солитон» отвечает с упоминанием карточки.
- **SC-002**: Wikidata item доступен по постоянной ссылке Qxxx.
- **SC-003**: IndexNow ping корректно работает (тестовый POST → 200).
- **SC-004**: Organization JSON-LD содержит ≥2 ссылки `sameAs`.

## Assumptions

- Реальные контакты Солитон будут получены от владельца (см. deferred-content-track п.3).
- Доменное имя `soliton.ru` (или другое) будет настроено.
- Регистрация на Yandex Business — organisational задача владельца.
