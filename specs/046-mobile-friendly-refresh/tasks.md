# Tasks: Mobile-Friendly Refresh

**Spec**: `specs/046-mobile-friendly-refresh/spec.md`

**Plan**: `specs/046-mobile-friendly-refresh/plan.md`

## Tasks

- [x] T046-01 — Добавить `export const viewport` в `apps/web/src/app/layout.tsx`.
- [x] T046-02 — Добавить mobile-safe base CSS в `apps/web/src/app/globals.css` (overflow-x hidden, safe-area, input font-size 16px).
- [x] T046-03 — Создать `apps/web/src/components/site/MobileDrawer.tsx` (client component).
- [x] T046-04 — Перестроить `SiteHeader.tsx`: гамбургер + drawer + видимый phone CTA на мобильнике.
- [x] T046-05 — Переделать mobile-режим `CatalogFilterableList.tsx` через `MobileDrawer side="right"`.
- [x] T046-06 — Создать `ProductStickyCta` и подключить в `ProductDetailPage.tsx`.
- [x] T046-07 — Проверить и подправить tap-target sizes в `CartView`, `PhysicalCheckoutForm`, `InvoiceCheckoutForm`, `RfqForm`.
- [x] T046-08 — `pnpm typecheck && pnpm lint` — зелёные.
- [x] T046-09 — Dev-смоук на 375px width через `curl` (просто проверить, что HTML собирается).
- [x] T046-10 — `git commit` всего изменения spec 045 + 046.
- [x] T046-11 — rsync + docker compose build + up на mac-mini.
- [x] T046-12 — smoke-тест https://soliton.heado.tech на mobile UA.
