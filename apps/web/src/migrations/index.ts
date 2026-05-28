import * as migration_20260525_151746_initial_pdumarket_prod from './20260525_151746_initial_pdumarket_prod';
import * as migration_20260526_130918_058_v1_analytics_attribution from './20260526_130918_058_v1_analytics_attribution';
import * as migration_20260526_192423_add_product_physical_packaging from './20260526_192423_add_product_physical_packaging';
import * as migration_20260526_shipping_sender_pickup_type from './20260526_shipping_sender_pickup_type';
import * as migration_20260527_001_add_own_carrier_enum from './20260527_001_add_own_carrier_enum';
import * as migration_20260527_002_rename_tc_to_own_carrier from './20260527_002_rename_tc_to_own_carrier';
import * as migration_20260528_add_delivery_handover_note from './20260528_add_delivery_handover_note';
import * as migration_20260528_add_invoice_footer_note from './20260528_add_invoice_footer_note';

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
  {
    up: migration_20260527_001_add_own_carrier_enum.up,
    down: migration_20260527_001_add_own_carrier_enum.down,
    name: '20260527_001_add_own_carrier_enum'
  },
  {
    up: migration_20260527_002_rename_tc_to_own_carrier.up,
    down: migration_20260527_002_rename_tc_to_own_carrier.down,
    name: '20260527_002_rename_tc_to_own_carrier'
  },
  {
    up: migration_20260528_add_delivery_handover_note.up,
    down: migration_20260528_add_delivery_handover_note.down,
    name: '20260528_add_delivery_handover_note'
  },
  {
    up: migration_20260528_add_invoice_footer_note.up,
    down: migration_20260528_add_invoice_footer_note.down,
    name: '20260528_add_invoice_footer_note'
  },
];
