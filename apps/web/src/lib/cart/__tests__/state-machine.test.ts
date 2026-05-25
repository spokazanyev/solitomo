import { describe, expect, it } from "vitest";

type CartStatus = "active" | "abandoned" | "converted" | "expired" | "merged";

const TRANSITIONS: Record<CartStatus, ReadonlySet<CartStatus>> = {
  active: new Set<CartStatus>(["active", "abandoned", "converted", "expired", "merged"]),
  abandoned: new Set<CartStatus>(["active", "abandoned", "converted", "expired", "merged"]),
  converted: new Set<CartStatus>(["converted", "active"]),
  expired: new Set<CartStatus>(["expired", "active"]),
  merged: new Set<CartStatus>(["merged"]),
};

interface Ctx {
  recoverFromConverted?: boolean;
  adminRestore?: boolean;
}

function canTransition(from: CartStatus, to: CartStatus, ctx: Ctx = {}): boolean {
  const allowed = TRANSITIONS[from];
  if (!allowed?.has(to)) return false;
  if (from === "converted" && to === "active" && !ctx.recoverFromConverted) return false;
  if (from === "expired" && to === "active" && !ctx.adminRestore) return false;
  return true;
}

describe("canTransition", () => {
  it("allows active → abandoned", () => {
    expect(canTransition("active", "abandoned")).toBe(true);
  });

  it("allows active → converted", () => {
    expect(canTransition("active", "converted")).toBe(true);
  });

  it("allows abandoned → active (recovery on user return)", () => {
    expect(canTransition("abandoned", "active")).toBe(true);
  });

  it("blocks converted → active without recoverFromConverted flag", () => {
    expect(canTransition("converted", "active")).toBe(false);
  });

  it("allows converted → active WITH recoverFromConverted flag (FR-5223a)", () => {
    expect(canTransition("converted", "active", { recoverFromConverted: true })).toBe(true);
  });

  it("blocks expired → active without admin flag", () => {
    expect(canTransition("expired", "active")).toBe(false);
  });

  it("allows expired → active WITH adminRestore flag", () => {
    expect(canTransition("expired", "active", { adminRestore: true })).toBe(true);
  });

  it("blocks merged → anything except merged", () => {
    expect(canTransition("merged", "active")).toBe(false);
    expect(canTransition("merged", "abandoned")).toBe(false);
    expect(canTransition("merged", "converted")).toBe(false);
    expect(canTransition("merged", "merged")).toBe(true);
  });

  it("blocks converted → expired", () => {
    expect(canTransition("converted", "expired")).toBe(false);
  });

  it("blocks converted → abandoned", () => {
    expect(canTransition("converted", "abandoned")).toBe(false);
  });

  it("allows self-loops (same status)", () => {
    expect(canTransition("active", "active")).toBe(true);
    expect(canTransition("abandoned", "abandoned")).toBe(true);
    expect(canTransition("expired", "expired")).toBe(true);
  });
});
