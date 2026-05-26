/**
 * Next.js middleware (Edge runtime).
 *
 * Соответствие спеке 058:
 * - FR-023, FR-030, FR-242: захват UTM/yclid/gclid + referer-классификация при
 *   входе посетителя → cookie `_solitomo_attribution`
 * - FR-180: cookie `_solitomo_first_seen` (для cohort analysis)
 * - FR-271: env-marker header
 *
 * Edge-compat: только native Web API (Request/Response/cookies), no `node:*`.
 */

import { NextResponse, type NextRequest } from "next/server";

import {
  ATTRIBUTION_COOKIE_NAME,
  ATTRIBUTION_COOKIE_TTL_SECONDS,
  decodeAttributionCookie,
  encodeAttributionCookie,
  extractTouchpointFromRequest,
  FIRST_SEEN_COOKIE_NAME,
  FIRST_SEEN_COOKIE_TTL_SECONDS,
  shouldOverwriteAttribution,
} from "./lib/analytics/attribution.ts";
import { getEnvironment } from "./lib/analytics/env-marker.ts";

export const config = {
  // Не запускаем на статике, API-, admin-routes; только публичные страницы.
  matcher: [
    "/((?!api|admin|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|pdf|css|js|woff|woff2)).*)",
  ],
};

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // FR-271: env-marker header (страховка для detection of misrouted traffic)
  response.headers.set("X-Soliton-Env", getEnvironment());

  // FR-030..035: attribution cookie capture
  try {
    const refererHeader = request.headers.get("referer");
    const touchpoint = extractTouchpointFromRequest({
      url: request.nextUrl,
      refererHeader,
    });

    if (touchpoint) {
      const existingCookie = request.cookies.get(ATTRIBUTION_COOKIE_NAME);
      const existing = existingCookie ? decodeAttributionCookie(existingCookie.value) : null;
      if (shouldOverwriteAttribution(existing, touchpoint)) {
        response.cookies.set({
          name: ATTRIBUTION_COOKIE_NAME,
          value: encodeAttributionCookie(touchpoint),
          maxAge: ATTRIBUTION_COOKIE_TTL_SECONDS,
          sameSite: "lax",
          secure: getEnvironment() === "production",
          path: "/",
          // НЕ httpOnly: нужно JS-чтение для отправки в events.ts
        });
      }
    }
  } catch {
    // Любая ошибка в attribution-capture не должна ломать рендеринг
  }

  // FR-180: first_seen cookie (cohort analysis primary source)
  try {
    if (!request.cookies.get(FIRST_SEEN_COOKIE_NAME)) {
      response.cookies.set({
        name: FIRST_SEEN_COOKIE_NAME,
        value: new Date().toISOString(),
        maxAge: FIRST_SEEN_COOKIE_TTL_SECONDS,
        sameSite: "lax",
        secure: getEnvironment() === "production",
        path: "/",
      });
    }
  } catch {
    // ignore
  }

  return response;
}
