# Implementation Plan: Robots Refinement

**Branch**: `030-robots-refinement`

**Spec**: [spec.md](./spec.md)

## Touchpoints

- `apps/web/src/app/robots.ts`

## Change

Remove `/*?*` from disallow list. Keep `/admin/`, `/api/`. Add `/_next/`.

## Validation

- `curl /robots.txt`
- Manual check: `?utm_source=test` returns 200 and canonical correct.
