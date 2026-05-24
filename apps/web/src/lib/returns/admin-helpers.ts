import "server-only";

/**
 * Shared admin-route helpers for Returns (053).
 *
 * Common path: load payload + assert admin auth + load return by id.
 */

import { headers } from "next/headers";
import { getPayload, type Payload } from "payload";
import configPromise from "@payload-config";

import { returnError, type ReturnErrorBody } from "./api-utils";
import { findById, type ReturnRecord } from "./repository";
import type { NextResponse } from "next/server";

export interface AdminContext {
  payload: Payload;
  user: { id: string; email?: string; role?: string };
  returnDoc: ReturnRecord;
}

/**
 * Roles allowed to perform Returns actions. Admin and Sales only.
 * SEO/Editor/Catalog_manager/Agent are not authorized.
 */
const RETURNS_ROLES = new Set(["admin", "sales"]);

/**
 * Load Payload + verify admin session + fetch Return by id.
 *
 * Returns either:
 *  - `{ ok: true, ctx }` — caller can proceed
 *  - `{ ok: false, response }` — caller must return the response immediately
 *
 * This shape narrows correctly under TypeScript discriminated-union flow.
 */
export async function loadAdminContext(
  id: string,
): Promise<
  | { ok: true; ctx: AdminContext }
  | { ok: false; response: NextResponse<ReturnErrorBody> }
> {
  const payload = await getPayload({ config: configPromise });
  const auth = await payload.auth({ headers: await headers() });
  if (!auth.user) {
    return { ok: false, response: returnError(401, "unauthorized", "Admin session required") };
  }

  // H1 fix: role-based access — only admin/sales may operate Returns
  const role = (auth.user as { role?: string }).role;
  if (!role || !RETURNS_ROLES.has(role)) {
    return {
      ok: false,
      response: returnError(401, "unauthorized", "Insufficient role for Returns operations"),
    };
  }

  const returnDoc = await findById(payload, id);
  if (!returnDoc) {
    return { ok: false, response: returnError(404, "not_found", "Return not found") };
  }

  return {
    ok: true,
    ctx: {
      payload,
      user: {
        id: String(auth.user.id),
        email: (auth.user as { email?: string }).email,
        role,
      },
      returnDoc,
    },
  };
}

/**
 * Standalone role check for endpoints that don't need a Return loaded
 * (e.g. POST /api/admin/returns — manager creates).
 */
export async function assertAdminAuth(
  payload: Payload,
): Promise<
  | { ok: true; user: { id: string; email?: string; role: string } }
  | { ok: false; response: ReturnType<typeof returnError> }
> {
  const auth = await payload.auth({ headers: await headers() });
  if (!auth.user) {
    return { ok: false, response: returnError(401, "unauthorized", "Admin session required") };
  }
  const role = (auth.user as { role?: string }).role;
  if (!role || !RETURNS_ROLES.has(role)) {
    return {
      ok: false,
      response: returnError(401, "unauthorized", "Insufficient role for Returns operations"),
    };
  }
  return {
    ok: true,
    user: {
      id: String(auth.user.id),
      email: (auth.user as { email?: string }).email,
      role,
    },
  };
}
