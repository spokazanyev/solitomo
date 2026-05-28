import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetAnalyticsLoaderForTests,
  loadGoogleAnalytics,
  loadYandexMetrika,
} from "./analytics-loader";

type FakeScript = {
  tagName: "SCRIPT";
  async: boolean;
  src: string;
  text: string;
};

type DocumentMock = {
  head: { appendChild: (el: FakeScript) => FakeScript };
  createElement: (tag: string) => FakeScript;
  appended: FakeScript[];
};

function installDocumentMock(): DocumentMock {
  const appended: FakeScript[] = [];
  const docMock: DocumentMock = {
    appended,
    createElement(tag: string) {
      return {
        tagName: tag.toUpperCase() as "SCRIPT",
        async: false,
        src: "",
        text: "",
      };
    },
    head: {
      appendChild(el: FakeScript) {
        appended.push(el);
        return el;
      },
    },
  };
  (globalThis as unknown as { document: unknown }).document = docMock;
  return docMock;
}

function uninstallDocumentMock(): void {
  delete (globalThis as unknown as { document?: unknown }).document;
}

describe("loadGoogleAnalytics", () => {
  let docMock: DocumentMock;

  beforeEach(() => {
    docMock = installDocumentMock();
    __resetAnalyticsLoaderForTests();
  });

  afterEach(() => {
    uninstallDocumentMock();
    __resetAnalyticsLoaderForTests();
    vi.restoreAllMocks();
  });

  it("appends gtag.js script with the correct src", () => {
    loadGoogleAnalytics("G-ABC123");
    const remote = docMock.appended.find((s) => s.src);
    expect(remote).toBeTruthy();
    expect(remote?.src).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-ABC123",
    );
    expect(remote?.async).toBe(true);
  });

  it("appends inline init script that configures the measurement id", () => {
    loadGoogleAnalytics("G-ABC123");
    const init = docMock.appended.find((s) => s.text.length > 0);
    expect(init?.text).toContain("dataLayer");
    expect(init?.text).toContain("G-ABC123");
    expect(init?.text).toContain("gtag('config'");
  });

  it("is idempotent — second call with same id is a NOOP", () => {
    loadGoogleAnalytics("G-ABC123");
    const firstCount = docMock.appended.length;
    loadGoogleAnalytics("G-ABC123");
    expect(docMock.appended.length).toBe(firstCount);
  });

  it("loads distinct ids independently", () => {
    loadGoogleAnalytics("G-AAA");
    loadGoogleAnalytics("G-BBB");
    const srcs = docMock.appended.map((s) => s.src).filter(Boolean);
    expect(srcs.some((s) => s.includes("G-AAA"))).toBe(true);
    expect(srcs.some((s) => s.includes("G-BBB"))).toBe(true);
  });

  it("is a NOOP server-side (no document)", () => {
    uninstallDocumentMock();
    expect(() => loadGoogleAnalytics("G-X")).not.toThrow();
  });

  it("is a NOOP when id is empty", () => {
    loadGoogleAnalytics("");
    expect(docMock.appended.length).toBe(0);
  });
});

describe("loadYandexMetrika", () => {
  let docMock: DocumentMock;

  beforeEach(() => {
    docMock = installDocumentMock();
    __resetAnalyticsLoaderForTests();
  });

  afterEach(() => {
    uninstallDocumentMock();
    __resetAnalyticsLoaderForTests();
  });

  it("appends inline init referencing the standard tag.js url and counter id", () => {
    loadYandexMetrika("12345678");
    const init = docMock.appended.find((s) => s.text.length > 0);
    expect(init).toBeTruthy();
    expect(init?.text).toContain("https://mc.yandex.ru/metrika/tag.js");
    expect(init?.text).toContain("12345678");
    expect(init?.text).toContain("'init'");
  });

  it("uses tag.js with ?id=<counterId> query (modern style)", () => {
    loadYandexMetrika("109422539");
    const init = docMock.appended.find((s) => s.text.length > 0);
    expect(init?.text).toContain("https://mc.yandex.ru/metrika/tag.js?id=109422539");
  });

  it("init options match canonical Yandex.Metrika snippet (v1)", () => {
    loadYandexMetrika("109422539");
    const init = docMock.appended.find((s) => s.text.length > 0);
    const text = init?.text ?? "";
    // FR-110-115: ecommerce="dataLayer" — критично для встроенного e-commerce dashboard
    expect(text).toContain('ecommerce: "dataLayer"');
    // SSR-safe init (Next.js)
    expect(text).toContain("ssr: true");
    // FR-061-063
    expect(text).toContain("webvisor: true");
    expect(text).toContain("clickmap: true");
    expect(text).toContain("accurateTrackBounce: true");
    expect(text).toContain("trackLinks: true");
    // Explicit URL/referrer (SPA-safe)
    expect(text).toContain("referrer: document.referrer");
    expect(text).toContain("url: location.href");
  });

  it("is idempotent — second call with same counter id is a NOOP", () => {
    loadYandexMetrika("12345678");
    const firstCount = docMock.appended.length;
    loadYandexMetrika("12345678");
    expect(docMock.appended.length).toBe(firstCount);
  });

  it("is a NOOP server-side", () => {
    uninstallDocumentMock();
    expect(() => loadYandexMetrika("12345678")).not.toThrow();
  });

  it("is a NOOP when counter id is empty", () => {
    loadYandexMetrika("");
    expect(docMock.appended.length).toBe(0);
  });
});
