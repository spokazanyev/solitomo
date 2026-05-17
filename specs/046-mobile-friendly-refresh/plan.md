# Implementation Plan: Mobile-Friendly Refresh

**Spec**: `specs/046-mobile-friendly-refresh/spec.md`

## Архитектурные решения

### Viewport + base CSS

Добавляем `export const viewport: Viewport` в `apps/web/src/app/layout.tsx` с `viewportFit: "cover"` для iOS notch. В `globals.css` добавляем:

```css
@layer base {
  html, body { overflow-x: hidden; }
  body { padding-bottom: env(safe-area-inset-bottom); }
  /* Минимальный font-size 16px на интерактивных элементах — отключает iOS zoom-on-focus */
  input, select, textarea { font-size: 16px; }
}
```

(font-size override применяется только если у инпута нет своего размера; уже существующие `text-base` останутся 16px).

### Mobile drawer pattern (общий)

Заводим новый клиентский компонент `apps/web/src/components/site/MobileDrawer.tsx`:

```tsx
"use client";
export function MobileDrawer({ open, onClose, children, side = "right" }: ...) {
  // Управляет body overflow при открытом drawer.
  // Backdrop + sliding panel. Закрытие по Escape, backdrop tap, кнопке.
}
```

Используется в `SiteHeader` (меню) и `CatalogFilterableList` (фильтры).

### SiteHeader

Удаляем второй ряд горизонтального scroll-меню. Вместо него:

- На ≤lg: гамбургер-кнопка справа от логотипа открывает `MobileDrawer side="right"` с полным списком пунктов меню и телефоном внизу.
- На <md показываем иконку-телефон (`<a href="tel:...">`) рядом с корзиной, чтобы тап позвонить — в один клик.
- На ≥lg ничего не меняется.

### CatalogFilterableList

Текущий inline-expand на mobile заменяем на:

- Кнопка «Фильтры» открывает `MobileDrawer side="bottom"` (или `right`).
- Внутри drawer: scroll-контейнер с фильтрами + sticky футер `«Сбросить»` + `«Показать N»`.
- Десктоп (≥lg): sticky-сайдбар как сейчас.

### ProductDetailPage

Добавляем компонент `ProductStickyCta` (server-component, принимает Product) — рендерится только на ≤md (`lg:hidden` через wrapper). Содержит:

- цена (или «По запросу»)
- кнопка «В корзину» (existing `<AddToRfqButton>`)
- ссылка «КП» (текст с иконкой)

Фиксируется через `fixed bottom-0 inset-x-0 z-40 border-t bg-white shadow-lg` с safe-area padding.

Контент страницы получает `pb-24 lg:pb-0` чтобы sticky-полоса ничего не закрывала.

### Cart + Checkout forms

Беглый аудит:
- `CartView`: на mobile уже стекается. Add quick check that buttons are h-11 + total panel sticky on small screens.
- `PhysicalCheckoutForm`, `InvoiceCheckoutForm`: input/select size + h-11 на submit.
- `RfqForm`: те же правки.

### Tap target sizing

Заменяем `py-2` на `py-3` (вместе с `h-11`) на primary CTA. Линки в навигации/footer оставляем — text-sm c достаточным line-height.

## Что НЕ меняется

- Server components остаются server'ами (ProductDetailPage уже async server).
- `RfqCartLink` (уже h-10 w-10 — слегка увеличим до h-11).
- Главная Hero — на мобильнике уже стекается; H1 уже 4xl на phone.
- Footer — sm:grid-cols-3 + stack на phone, нет проблем.

## Validation gates

- `pnpm --filter @soliton/web typecheck`
- `pnpm --filter @soliton/web lint`
- Dev preview на 375px width: смоук-тест 5 страниц.
- После деплоя — `curl --resolve` + проверка HTML на наличие mobile-классов.

## Risks

- **Animation jank**: drawer slide-in может тормозить на старых устройствах. Митигация: использовать `transform: translateX` + GPU-ускоренный transition; не анимировать `width/left`.
- **Sticky CTA перекрывает footer**: тестируем pb-24 на product page.
- **Drawer body-lock**: при открытом drawer фон должен оставаться неподвижным. Митигация: `document.body.style.overflow = "hidden"` при open, восстановление при close.
- **iOS Safari 100vh bug**: используем `dvh` или `100svh` для drawer, fallback на `100vh`.
