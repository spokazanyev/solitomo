# Contract: Product `physicalPackaging` group

**Type**: Payload-CMS field contract
**Collection**: `products`
**Status**: Proposed

## Структура поля

```typescript
{
  name: 'physicalPackaging',
  type: 'group',
  label: { ru: 'Физические параметры упаковки', en: 'Physical packaging' },
  admin: {
    description: {
      ru: 'Заполните для точного расчёта стоимости доставки. Если пусто — используются дефолтные значения из настроек ApiShip.',
      en: 'Fill for accurate shipping cost calculation. Empty = uses ApiShip defaults.',
    },
  },
  fields: [
    {
      name: 'weightGrams',
      type: 'number',
      label: { ru: 'Масса, г', en: 'Weight, g' },
      min: 1,
      max: 200000,
      admin: { step: 1, placeholder: 'например, 8000' },
    },
    {
      name: 'lengthMm',
      type: 'number',
      label: { ru: 'Длина, мм', en: 'Length, mm' },
      min: 1,
      max: 2000,
      admin: { step: 1, placeholder: 'например, 1500' },
    },
    {
      name: 'widthMm',
      type: 'number',
      label: { ru: 'Ширина, мм', en: 'Width, mm' },
      min: 1,
      max: 2000,
      admin: { step: 1, placeholder: 'например, 100' },
    },
    {
      name: 'heightMm',
      type: 'number',
      label: { ru: 'Высота, мм', en: 'Height, mm' },
      min: 1,
      max: 2000,
      admin: { step: 1, placeholder: 'например, 100' },
    },
  ],
}
```

## REST API

После сохранения коллекции поля доступны в стандартном Payload REST API:

```
GET /api/products/:id  →  доступны как product.physicalPackaging.{weightGrams,lengthMm,widthMm,heightMm}
PUT /api/products/:id  →  принимает любое подмножество полей внутри physicalPackaging
```

## Defaults на чтение

- Если в БД null — REST API вернёт `physicalPackaging.weightGrams: null`.
- Если все 4 поля null — `physicalPackaging` может вернуться как `{}` или `null` (зависит от Payload версии). Frontend/mapper'у нужно safely handle оба случая.

## Validation errors

При сохранении значения вне диапазона Payload возвращает 400 с body:

```json
{
  "errors": [{
    "name": "physicalPackaging.weightGrams",
    "message": "Value must be between 1 and 200000"
  }]
}
```

Admin UI показывает ошибку inline возле поля.

## Visual indicator (admin list view)

В `admin.defaultColumns` для коллекции `products` добавляется колонка `physicalPackaging` с custom Cell-компонентом:

```tsx
// apps/web/src/admin/cells/PhysicalPackagingStatus.tsx
'use client';
export default function PhysicalPackagingStatus({ cellData }) {
  const filled =
    cellData?.weightGrams && cellData?.lengthMm &&
    cellData?.widthMm && cellData?.heightMm;
  return filled
    ? <span title="Габариты заполнены">✓</span>
    : <span title="Не заполнено — используются дефолтные значения" style={{ color: '#d97706' }}>⚠</span>;
}
```

В collection config:
```javascript
admin: {
  defaultColumns: ['sku', 'title', 'status', 'physicalPackaging', 'primaryCategory', 'updatedAt'],
  components: {
    cells: {
      physicalPackaging: '/admin/cells/PhysicalPackagingStatus.tsx',
    },
  },
}
```

## Migration backward-compatibility

Все 4 поля nullable. Существующие записи в `products` (66 шт.) получают NULL для всех 4 полей при миграции. Никаких backfill-операций не требуется.
