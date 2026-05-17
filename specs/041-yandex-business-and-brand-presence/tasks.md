# Tasks: Yandex Business + Brand Presence

## Code tasks

- [ ] T001 Добавить в `00-source-data/company/contacts.json` поле `externalProfiles[]` со структурой `{ platform, url }`. Поставить плейсхолдеры (Yandex Business, Wikidata, ...) с TODO(owner).
- [ ] T002 Обновить `apps/web/src/lib/company/get-company-contacts.ts` тип `CompanyContacts` — добавить `externalProfiles`.
- [ ] T003 В `createOrganizationJsonLd()` объединить `socials[]` + `externalProfiles[]` в `sameAs[]` (фильтровать пустые и TODO-placeholder'ы).
- [ ] T004 Создать `apps/web/src/app/[indexnowKey].txt/route.ts` (или статический файл в `public/`) — отдаёт `process.env.INDEXNOW_KEY` как text/plain, 404 если env не задан.
- [ ] T005 Создать `apps/web/src/lib/seo/notify-indexnow.ts` — функция отправляет POST на `yandex.com/indexnow` и `bing.com/indexnow`. В dev — `console.log`.
- [ ] T006 Добавить `INDEXNOW_KEY` в `.env.example`.

## Organisational tasks (owner)

Документируется в `deferred-content-track.md`:

- [ ] T007 Зарегистрировать Солитон в Yandex Business.
- [ ] T008 Создать Wikidata item.
- [ ] T009 Получить IndexNow ключ через Yandex.Webmaster.
- [ ] T010 Заполнить `externalProfiles` в `contacts.json` реальными URL.
