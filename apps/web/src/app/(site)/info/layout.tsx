import type { ReactNode } from "react";

/**
 * Layout for `/info/*` buyer-info pages (spec 057, US1).
 *
 * Intentionally minimal — `StaticPageRenderer` handles the in-page
 * breadcrumb and sidebar nav so the layout only sets the surface
 * background.
 */
export default function InfoLayout({ children }: { children: ReactNode }) {
  return <section className="bg-white">{children}</section>;
}
