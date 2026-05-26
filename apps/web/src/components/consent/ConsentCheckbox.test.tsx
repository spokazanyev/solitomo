import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";

// next/link stub — pure passthrough so href/target/className survive into HTML.
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", { href, ...rest }, children),
}));

import { ConsentCheckbox } from "./ConsentCheckbox";

/**
 * The repo vitest config uses `environment: "node"` and has no
 * @testing-library/react / jsdom. We therefore exercise the component
 * by static-rendering to HTML and asserting on attributes; the
 * onChange behavior is verified directly against the React element's
 * props (no DOM event simulation possible without jsdom).
 */
describe("ConsentCheckbox", () => {
  it("renders with unchecked input by default", () => {
    const html = renderToStaticMarkup(
      <ConsentCheckbox value={false} onChange={() => {}} />,
    );
    expect(html).toContain('type="checkbox"');
    // React omits `checked` attribute when value is false in static markup.
    expect(html).not.toMatch(/\bchecked\b/);
  });

  it("renders with checked input when value=true", () => {
    const html = renderToStaticMarkup(
      <ConsentCheckbox value={true} onChange={() => {}} />,
    );
    expect(html).toMatch(/\bchecked\b/);
  });

  it("invokes onChange with true when the input change handler fires", () => {
    const spy = vi.fn();
    // Build the element so we can read the input's onChange directly.
    const element = ConsentCheckbox({ value: false, onChange: spy }) as React.ReactElement<{
      children: React.ReactElement[];
    }>;
    // <label> wraps an <input> and a <span>.
    const labelChildren = element.props.children;
    const inputEl = labelChildren.find(
      (c) =>
        React.isValidElement(c) &&
        (c.props as { type?: string }).type === "checkbox",
    ) as React.ReactElement<{
      onChange: (e: { target: { checked: boolean } }) => void;
    }>;
    expect(inputEl).toBeTruthy();
    const onChange = inputEl.props.onChange;
    onChange({ target: { checked: true } });
    expect(spy).toHaveBeenCalledWith(true);
    onChange({ target: { checked: false } });
    expect(spy).toHaveBeenCalledWith(false);
  });

  it("default label includes links to /legal/offer/ and /legal/pd-policy/", () => {
    const html = renderToStaticMarkup(
      <ConsentCheckbox value={false} onChange={() => {}} />,
    );
    expect(html).toContain("офертой");
    expect(html).toContain("политикой обработки персональных данных");
    expect(html).toMatch(/href="\/legal\/offer\/"/);
    expect(html).toMatch(/href="\/legal\/pd-policy\/"/);
  });

  it("aria-required is set to true when required=true (default)", () => {
    const html = renderToStaticMarkup(
      <ConsentCheckbox value={false} onChange={() => {}} />,
    );
    expect(html).toMatch(/aria-required="true"/);
    expect(html).toMatch(/\brequired\b/);
  });

  it("aria-required is false when required=false", () => {
    const html = renderToStaticMarkup(
      <ConsentCheckbox value={false} onChange={() => {}} required={false} />,
    );
    expect(html).toMatch(/aria-required="false"/);
  });

  it("label is associated with the input via htmlFor / id", () => {
    const html = renderToStaticMarkup(
      <ConsentCheckbox value={false} onChange={() => {}} />,
    );
    // Default id is "consent-checkbox"; the label wraps the input and also
    // exposes a `for` attribute (React → `htmlFor`).
    expect(html).toMatch(/for="consent-checkbox"/);
    expect(html).toMatch(/id="consent-checkbox"/);
  });

  it("respects custom id prop", () => {
    const html = renderToStaticMarkup(
      <ConsentCheckbox value={false} onChange={() => {}} id="my-consent" />,
    );
    expect(html).toMatch(/id="my-consent"/);
    expect(html).toMatch(/for="my-consent"/);
  });

  it("respects custom label prop", () => {
    const html = renderToStaticMarkup(
      <ConsentCheckbox
        value={false}
        onChange={() => {}}
        label={<span data-testid="custom">CUSTOM</span>}
      />,
    );
    expect(html).toContain("CUSTOM");
    expect(html).not.toContain("офертой");
  });
});
