# Payment system logos

Placeholders — replace with official brandbook SVG before launch:

- `mir.svg` — МИР (https://www.nspk.ru/cards-mir/brand/)
- `visa.svg` — Visa (https://merchantsignageusa.visa.com/ or https://usa.visa.com/about-visa/our_business/visa-brand-and-marketing.html)
- `mastercard.svg` — Mastercard (https://brand.mastercard.com/brandcenter.html)
- `sbp.svg` — Система быстрых платежей / СБП (https://sbp.nspk.ru/)

All four logos are used in `SiteFooter` (`apps/web/src/components/site/SiteFooter.tsx`) under the "Принимаем к оплате" block. Sizes are 48×24 in markup but the SVG viewBox is 120×60 — keep new files matching this aspect ratio (2:1) so existing CSS works.

Owner is expected to swap these via direct PR or the admin pipeline once licensing materials are signed.
