import "server-only";

/**
 * Cart token cookie helpers (052 FR-5201).
 *
 * Cookie is HTTP-only, SameSite=Lax, Secure in production, Max-Age=30d.
 */

import { cookies } from "next/headers";

export const CART_COOKIE_NAME = process.env.CART_TOKEN_COOKIE_NAME ?? "soliton_cart_token";
const CART_COOKIE_MAX_AGE = Number(process.env.CART_TOKEN_COOKIE_MAX_AGE ?? 60 * 60 * 24 * 30); // 30 days

export async function getCartTokenFromCookie(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(CART_COOKIE_NAME)?.value;
  return value && value.trim().length > 0 ? value : null;
}

export async function setCartTokenCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  });
}

export async function clearCartTokenCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE_NAME);
}
