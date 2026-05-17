"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "@payloadcms/ui";

const blockedDocumentSubRoutes = new Set(["api", "create", "versions"]);

function getCollectionListPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const adminIndex = segments.indexOf("admin");

  if (adminIndex === -1) {
    return null;
  }

  const route = segments.slice(adminIndex);

  if (route[0] !== "admin" || route[1] !== "collections" || !route[2] || !route[3]) {
    return null;
  }

  if (blockedDocumentSubRoutes.has(route[3]) || route.length !== 4) {
    return null;
  }

  return `/admin/collections/${route[2]}/`;
}

export function DiscardChangesLink() {
  const pathname = usePathname();
  const router = useRouter();
  const { i18n } = useTranslation();
  const listPath = getCollectionListPath(pathname);

  if (!listPath) {
    return null;
  }

  const isRussian = i18n.language === "ru";
  const label = isRussian ? "Выйти без сохранения" : "Exit without saving";
  const title = isRussian
    ? "Вернуться к списку коллекции без сохранения текущей формы"
    : "Return to the collection list without saving the current form";

  return (
    <button
      onClick={() => {
        router.push(listPath);
      }}
      style={{
        background: "var(--theme-input-bg)",
        border: "1px solid var(--theme-elevation-250)",
        borderRadius: 4,
        color: "var(--theme-text)",
        cursor: "pointer",
        font: "inherit",
        marginInlineEnd: 8,
        minHeight: 34,
        padding: "4px 12px",
        whiteSpace: "nowrap",
      }}
      title={title}
      type="button"
    >
      {label}
    </button>
  );
}
