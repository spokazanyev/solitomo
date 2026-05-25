// Auto-managed by `payload migrate:create`. When you add a new migration:
//   1. pnpm --filter @soliton/web exec payload migrate:create <name>
//   2. Verify the new migration file uses underscore-separated identifiers
//      (Payload's generated import names must be valid JS identifiers — file
//      names with hyphens break this index.ts; rename to underscores if so).

import * as migration_20260525_151746_initial_pdumarket_prod from "./20260525_151746_initial_pdumarket_prod";

export const migrations = [
  {
    up: migration_20260525_151746_initial_pdumarket_prod.up,
    down: migration_20260525_151746_initial_pdumarket_prod.down,
    name: "20260525_151746_initial_pdumarket_prod",
  },
];
