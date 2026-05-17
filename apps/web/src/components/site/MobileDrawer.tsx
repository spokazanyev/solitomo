"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

type MobileDrawerProps = {
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  open: boolean;
  side?: "right" | "bottom";
  title?: string;
};

export function MobileDrawer({
  children,
  footer,
  onClose,
  open,
  side = "right",
  title,
}: MobileDrawerProps) {
  useEffect(() => {
    if (!open) return undefined;

    document.body.classList.add("drawer-open");
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.classList.remove("drawer-open");
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const panelClasses =
    side === "right"
      ? `fixed inset-y-0 right-0 z-50 flex w-[min(360px,90vw)] flex-col bg-white shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`
      : `fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`;

  return (
    <>
      <div
        aria-hidden
        className={`fixed inset-0 z-40 bg-slate-950/40 transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <aside
        aria-hidden={!open}
        aria-modal="true"
        className={panelClasses}
        role="dialog"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <p className="text-base font-semibold text-slate-950">
            {title ?? "Меню"}
          </p>
          <button
            aria-label="Закрыть"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          className="flex-1 overflow-y-auto overscroll-contain px-5 py-4"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
        {footer ? (
          <div
            className="border-t border-slate-200 px-5 py-4"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        ) : null}
      </aside>
    </>
  );
}
