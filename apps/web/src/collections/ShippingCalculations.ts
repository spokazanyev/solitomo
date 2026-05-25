import type { CollectionConfig } from "payload";

export const ShippingCalculations: CollectionConfig = {
  slug: "shipping-calculations",
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  admin: {
    hidden: true,
    useAsTitle: "key",
  },
  fields: [
    { name: "key", type: "text", required: true, unique: true,
      admin: { description: "apiship:calc:{cartId}:{shippingOptionId}" } },
    { name: "data", type: "json", required: true },
    { name: "expiresAt", type: "date", required: true },
  ],
  indexes: [
    { fields: ["expiresAt"] },
  ],
};
