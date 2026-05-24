import "server-only";

/**
 * Customer session helpers (054).
 *
 * Wraps payload.auth() for the `customers` collection. The session cookie
 * (`customer_session`) is read by Payload's auth middleware automatically;
 * we just need the right headers to be passed through.
 */

import { getPayload, type Payload } from "payload";
import configPromise from "@payload-config";

import { toCustomerRecord, type CustomerRecord } from "./repository";

/**
 * Try to resolve the current customer from the incoming request.
 * Returns null if no valid session.
 *
 * Uses Payload local API's `auth()` with the customer cookie name override.
 */
export async function loadCustomerFromRequest(
  req: Request,
): Promise<{ payload: Payload; customer: CustomerRecord } | null> {
  const payload = await getPayload({ config: configPromise });

  // Payload's auth() reads the default cookie name; for the `customers` collection
  // we need to extract the token from `customer_session` cookie ourselves.
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)customer_session=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;

  try {
    // Use overrideAccess + manual cookie auth via payload.find on customers
    // (Payload auth() default reads admin token only).
    // We verify the JWT token via Payload's internal verification.
    const result = await payload.auth({
      headers: new Headers({ Authorization: `JWT ${token}` }),
    });
    // payload.auth() returns the User (admin) by default — for customer collection
    // we need to check if it matched a customer instead.
    const userCollection = (result as { collection?: string }).collection;
    if (!result.user || (userCollection && userCollection !== "customers")) {
      return null;
    }
    const customer = toCustomerRecord(result.user as unknown as Record<string, unknown>);
    if (customer.deletedAt) return null;
    return { payload, customer };
  } catch {
    return null;
  }
}
