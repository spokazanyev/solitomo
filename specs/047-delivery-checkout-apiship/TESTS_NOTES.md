# 047 — Unit tests for delivered core

## Test runner

Vitest (added in this PR). No tests existed in the monorepo before this change.

- `vitest@^2.1.0`
- `@vitest/coverage-v8@^2.1.0`

Configured via `apps/web/vitest.config.ts` with two aliases:

- `@` → `apps/web/src`
- `server-only` → `apps/web/src/__test-utils__/server-only-shim.ts` (empty module so that
  files using `import "server-only"` can be imported under Node/Vitest).

## How to run

From the repo root:

```bash
pnpm --filter @soliton/web test           # one-shot
pnpm --filter @soliton/web test:watch     # interactive
pnpm --filter @soliton/web test:coverage  # coverage via v8
```

## Test files added (7)

| File | Coverage |
| ---- | -------- |
| `apps/web/src/lib/shipping/apiship/__tests__/status-map.test.ts` | `mapApiShipStatus`, `isTerminalStatus`, `shouldUpgradeStatus`, `mapShipmentToOrderStatus` |
| `apps/web/src/lib/shipping/apiship/__tests__/retry.test.ts` | `executeWithRetry`: happy path, retry-until-ready, exhausted attempts, last-error surfacing |
| `apps/web/src/lib/shipping/apiship/__tests__/mappers.test.ts` | `toCalculatorRequest` (incl. defaults fallback), `toShippingRate`, `pickCheapestTariff`, `toOrderRequest`, `toPickupPoints` (incl. maxDimensions filter) |
| `apps/web/src/lib/shipping/fallback/__tests__/provider.test.ts` | `FallbackShippingProvider.calculate` returns 4 rates; `createShipment` returns `status='none'` |
| `apps/web/src/lib/lifecycle/__tests__/status-machine.test.ts` | allowed/forbidden transitions, completed lock (FR-905), delivered → returned/completed |
| `apps/web/src/lib/lifecycle/__tests__/events.test.ts` | subscriber dispatch, isolation on throw, deduplication by eventId, kinds filtering; uses `vi.mock("payload", ...)` and `vi.mock("@payload-config", ...)` |
| `apps/web/src/lib/notifications/__tests__/stub.test.ts` | T-001/T-003/T-005/T-008 renderers, no NaN/undefined in output, returns null without email, dry-run when `EMAIL_API_KEY` empty, sandbox mode |

## Notes for future contributors

- `apps/web/src/lib/lifecycle/events.ts` and `apps/web/src/lib/notifications/stub.ts`
  both start with `import "server-only"`. Vitest substitutes that import via alias
  (see `vitest.config.ts`); do **not** remove the alias or those tests will refuse to
  load. The shim lives at `src/__test-utils__/server-only-shim.ts`.
- The events module holds two pieces of module-level state (a `subscribers` array
  and a `Set` used for deduplication). Vitest isolates module state **per test file**,
  so tests across different files don't interfere. Within a file, tests register
  unique subscriber names and use distinct `eventIdSuffix` values to avoid collisions.
- `registerStubEmailSubscriber` self-guards with a `registered` boolean — once
  registered in a process, it cannot be re-registered. Tests in `stub.test.ts` call
  it once at describe-time and avoid unregistering the `047-email-stub` between tests.
- Email send paths to Postmark/Mailgun are **not** exercised; the renderers and the
  dry-run branch are covered. End-to-end provider integration belongs in a separate
  integration suite (out of scope for this MVP test pass).
