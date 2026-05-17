"use client";

import { useTranslation } from "@payloadcms/ui";
import type { AcceptedLanguages } from "@payloadcms/translations";

const languageNames: Record<string, string> = {
  en: "English",
  ru: "Русский",
};

export function AdminLanguageSwitcher() {
  const { i18n, languageOptions, switchLanguage } = useTranslation();

  if (!languageOptions?.length || !switchLanguage) {
    return null;
  }

  return (
    <div
      style={{
        alignItems: "center",
        display: "inline-flex",
        gap: 8,
        marginInlineStart: 12,
      }}
    >
      <span style={{ color: "var(--theme-elevation-600)", fontSize: 13 }}>
        {i18n.language === "ru" ? "Язык" : "Language"}
      </span>
      <span
        style={{
          display: "inline-flex",
          gap: 2,
        }}
      >
        {languageOptions.map((language) => {
          const isActive = language.value === i18n.language;

          return (
            <button
              aria-label={languageNames[language.value] ?? language.label}
              aria-pressed={isActive}
              disabled={isActive}
              key={language.value}
              onClick={() => {
                void switchLanguage(language.value as AcceptedLanguages);
              }}
              style={{
                background: isActive ? "var(--theme-elevation-800)" : "var(--theme-input-bg)",
                border: "1px solid var(--theme-elevation-250)",
                borderRadius: 4,
                color: isActive ? "var(--theme-bg)" : "var(--theme-text)",
                cursor: isActive ? "default" : "pointer",
                font: "inherit",
                minHeight: 34,
                minWidth: 44,
                padding: "4px 10px",
              }}
              type="button"
            >
              {language.value.toUpperCase()}
            </button>
          );
        })}
      </span>
    </div>
  );
}
