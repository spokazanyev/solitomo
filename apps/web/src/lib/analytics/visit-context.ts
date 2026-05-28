/**
 * Visit context для analytics events (FR-020..024).
 *
 * Каждое событие в dataLayer должно содержать base parameters:
 * - page_type — закрытый список значений
 * - cluster (опционально) — SEO-кластер
 * - user_type — anonymous | customer | legal_entity
 * - session_started_via (опционально) — utm_source первого визита
 * - env — production | staging | development
 *
 * Этот модуль предоставляет helpers для:
 * - вычисления page_type из pathname (server и client стороны)
 * - вычисления user_type из cookie/customer-session (server-side)
 * - доступа из client-кода через AnalyticsContextProvider (отдельный файл)
 */

export type PageType =
  | "home"
  | "catalog"
  | "category"
  | "pdp"
  | "knowledge"
  | "b2b"
  | "checkout"
  | "account"
  | "info"
  | "cart"
  | "success"
  | "other";

export type UserType = "anonymous" | "customer" | "legal_entity";

export interface VisitContext {
  pageType: PageType;
  cluster?: string;
  userType: UserType;
  sessionStartedVia?: string;
  env: "production" | "staging" | "development";
}

/**
 * Page-type вычисляется по pathname с консервативным fallback'ом.
 * RSC может также передавать explicit cluster (например, для knowledge-page).
 */
export function inferPageTypeFromPath(pathname: string): PageType {
  // Normalize
  const p = pathname.toLowerCase();

  if (p === "/" || p === "") return "home";
  if (p.startsWith("/catalog/") || p === "/catalog") {
    // /catalog/setevye-filtry/ — category; /catalog/ — listing main
    return p === "/catalog/" ? "catalog" : "category";
  }
  if (p.startsWith("/product/")) return "pdp";
  if (p.startsWith("/knowledge/") || p.startsWith("/articles/")) return "knowledge";
  if (p.startsWith("/b2b/")) return "b2b";
  if (p === "/cart/" || p === "/cart") return "cart";
  if (p.startsWith("/cart/checkout") || p.startsWith("/checkout/")) return "checkout";
  if (p.startsWith("/cart/order/") || p.startsWith("/payment/return/")) return "success";
  if (p.startsWith("/me/") || p === "/me") return "account";
  if (p.startsWith("/info/") || p.startsWith("/legal/") || p.startsWith("/company/")) return "info";

  return "other";
}

/**
 * Hybrid user_type rule (Clarification Q1, FR-022):
 * 1. Если в cookie `_solitomo_legal_entity_flag` есть marker → 'legal_entity'
 * 2. Если customer authenticated AND имеет companyId → 'legal_entity'
 * 3. Если customer authenticated без company → 'customer'
 * 4. Иначе → 'anonymous'
 *
 * Этот helper — pure function, принимает inputs и возвращает enum.
 * Cookie reading + customer-session loading — caller's responsibility.
 */
export function computeUserType(args: {
  legalEntityCookieSet: boolean;
  customerAuthenticated: boolean;
  customerHasCompany: boolean;
}): UserType {
  if (args.legalEntityCookieSet || args.customerHasCompany) return "legal_entity";
  if (args.customerAuthenticated) return "customer";
  return "anonymous";
}
