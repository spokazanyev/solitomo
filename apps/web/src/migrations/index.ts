import * as migration_20260525_151746_initial_pdumarket_prod from './20260525_151746_initial_pdumarket_prod';
import * as migration_20260526_130918_058_v1_analytics_attribution from './20260526_130918_058_v1_analytics_attribution';
import * as migration_20260526_192423_add_product_physical_packaging from './20260526_192423_add_product_physical_packaging';
import * as migration_20260526_shipping_sender_pickup_type from './20260526_shipping_sender_pickup_type';

export const migrations = [
  {
    up: migration_20260525_151746_initial_pdumarket_prod.up,
    down: migration_20260525_151746_initial_pdumarket_prod.down,
    name: '20260525_151746_initial_pdumarket_prod',
  },
  {
    up: migration_20260526_130918_058_v1_analytics_attribution.up,
    down: migration_20260526_130918_058_v1_analytics_attribution.down,
    name: '20260526_130918_058_v1_analytics_attribution',
  },
  {
    up: migration_20260526_192423_add_product_physical_packaging.up,
    down: migration_20260526_192423_add_product_physical_packaging.down,
    name: '20260526_192423_add_product_physical_packaging',
  },
  {
    up: migration_20260526_shipping_sender_pickup_type.up,
    down: migration_20260526_shipping_sender_pickup_type.down,
    name: '20260526_shipping_sender_pickup_type'
  },
];
