import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  COOKIE_CONSENT_NAME,
  clearCookieConsent,
  readCookieConsent,
  setCookieConsent,
} from "./cookie-consent";

type CookieJar = { value: string };

function installDocumentMock(jar: CookieJar): void {
  const docMock = {} as { cookie: string };
  Object.defineProperty(docMock, "cookie", {
    configurable: true,
    get: () => jar.value,
    set: (next: string) => {
      // Real browsers append cookies; for the tests we treat the latest
      // write as the active value (good enough for parser checks).
      jar.value = jar.value
        ? `${jar.value}; ${next.split(";")[0]}`
        : next.split(";")[0];
      // Stash the full write on the mock so tests can inspect attributes.
      (docMock as unknown as { lastWrite: string }).lastWrite = next;
    },
  });
  (globalThis as unknown as { document: unknown }).document = docMock;
  (globalThis as unknown as { window: unknown }).window = {
    location: { protocol: "http:" },
  };
}

function uninstallDocumentMock(): void {
  delete (globalThis as unknown as { document?: unknown }).document;
  delete (globalThis as unknown as { window?: unknown }).window;
}

describe("readCookieConsent", () => {
  let jar: CookieJar;

  beforeEach(() => {
    jar = { value: "" };
    installDocumentMock(jar);
  });

  afterEach(() => {
    uninstallDocumentMock();
    vi.restoreAllMocks();
  });

  it("returns null when document is undefined (SSR safety)", () => {
    uninstallDocumentMock();
    expect(readCookieConsent()).toBeNull();
  });

  it("returns null when cookie is missing", () => {
    jar.value = "other=foo; cart_token=abc";
    expect(readCookieConsent()).toBeNull();
  });

  it("returns 'accepted' when cookie value is accepted", () => {
    jar.value = `${COOKIE_CONSENT_NAME}=accepted`;
    expect(readCookieConsent()).toBe("accepted");
  });

  it("returns 'declined' when cookie value is declined", () => {
    jar.value = `other=x; ${COOKIE_CONSENT_NAME}=declined; trailing=y`;
    expect(readCookieConsent()).toBe("declined");
  });

  it("returns null for unexpected values", () => {
    jar.value = `${COOKIE_CONSENT_NAME}=maybe`;
    expect(readCookieConsent()).toBeNull();
  });
});

describe("setCookieConsent", () => {
  let jar: CookieJar;

  beforeEach(() => {
    jar = { value: "" };
    installDocumentMock(jar);
  });

  afterEach(() => {
    uninstallDocumentMock();
  });

  it("is a NOOP server-side (no document)", () => {
    uninstallDocumentMock();
    expect(() => setCookieConsent("accepted")).not.toThrow();
  });

  it("writes cookie_consent=accepted with required attributes", () => {
    setCookieConsent("accepted");
    const write = (globalThis.document as unknown as { lastWrite: string })
      .lastWrite;
    expect(write).toContain("cookie_consent=accepted");
    expect(write).toContain("Max-Age=");
    expect(write).toContain("SameSite=Lax");
    expect(write).toContain("Path=/");
  });

  it("computes Max-Age from days argument (365d -> 31536000s)", () => {
    setCookieConsent("accepted", 365);
    const write = (globalThis.document as unknown as { lastWrite: string })
      .lastWrite;
    expect(write).toContain("Max-Age=31536000");
  });

  it("omits Secure on http origins", () => {
    setCookieConsent("declined");
    const write = (globalThis.document as unknown as { lastWrite: string })
      .lastWrite;
    expect(write).not.toContain("Secure");
  });

  it("adds Secure on https origins", () => {
    (globalThis as unknown as { window: { location: { protocol: string } } }).window =
      { location: { protocol: "https:" } };
    setCookieConsent("accepted");
    const write = (globalThis.document as unknown as { lastWrite: string })
      .lastWrite;
    expect(write).toContain("Secure");
  });
});

describe("clearCookieConsent", () => {
  let jar: CookieJar;

  beforeEach(() => {
    jar = { value: "" };
    installDocumentMock(jar);
  });

  afterEach(() => {
    uninstallDocumentMock();
  });

  it("writes Max-Age=0", () => {
    clearCookieConsent();
    const write = (globalThis.document as unknown as { lastWrite: string })
      .lastWrite;
    expect(write).toContain("cookie_consent=");
    expect(write).toContain("Max-Age=0");
    expect(write).toContain("Path=/");
  });

  it("is a NOOP server-side", () => {
    uninstallDocumentMock();
    expect(() => clearCookieConsent()).not.toThrow();
  });
});
