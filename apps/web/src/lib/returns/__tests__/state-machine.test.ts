import { describe, expect, it } from "vitest";

type ReturnStatus =
  | "requested"
  | "approved"
  | "received"
  | "refunded"
  | "rejected"
  | "cancelled";

const ALLOWED: Record<ReturnStatus, ReadonlySet<ReturnStatus>> = {
  requested: new Set<ReturnStatus>(["requested", "approved", "rejected", "cancelled"]),
  approved: new Set<ReturnStatus>(["approved", "received", "rejected", "cancelled"]),
  received: new Set<ReturnStatus>(["received", "refunded", "rejected"]),
  refunded: new Set<ReturnStatus>(["refunded"]),
  rejected: new Set<ReturnStatus>(["rejected"]),
  cancelled: new Set<ReturnStatus>(["cancelled"]),
};

const TERMINAL: ReadonlySet<ReturnStatus> = new Set(["refunded", "rejected", "cancelled"]);
const OPEN_STATUSES: ReadonlySet<ReturnStatus> = new Set(["requested", "approved", "received"]);

function canTransition(from: ReturnStatus, to: ReturnStatus): boolean {
  return ALLOWED[from]?.has(to) ?? false;
}

function assertTransition(from: ReturnStatus, to: ReturnStatus, reason?: string | null) {
  if (from === to) return;
  if (!canTransition(from, to)) {
    throw new Error(`forbidden transition ${from} → ${to}`);
  }
  if (to === "rejected" && !reason?.trim()) {
    throw new Error("statusReason required for rejection");
  }
}

describe("Returns state machine", () => {
  describe("allowed transitions", () => {
    it("requested → approved", () => expect(canTransition("requested", "approved")).toBe(true));
    it("requested → rejected", () => expect(canTransition("requested", "rejected")).toBe(true));
    it("requested → cancelled", () => expect(canTransition("requested", "cancelled")).toBe(true));
    it("approved → received", () => expect(canTransition("approved", "received")).toBe(true));
    it("approved → rejected", () => expect(canTransition("approved", "rejected")).toBe(true));
    it("approved → cancelled", () => expect(canTransition("approved", "cancelled")).toBe(true));
    it("received → refunded", () => expect(canTransition("received", "refunded")).toBe(true));
    it("received → rejected", () => expect(canTransition("received", "rejected")).toBe(true));
  });

  describe("forbidden transitions", () => {
    it("requested → received (skip approval)", () =>
      expect(canTransition("requested", "received")).toBe(false));
    it("requested → refunded (skip everything)", () =>
      expect(canTransition("requested", "refunded")).toBe(false));
    it("approved → refunded (skip received)", () =>
      expect(canTransition("approved", "refunded")).toBe(false));
    it("refunded → anything (terminal)", () => {
      expect(canTransition("refunded", "approved")).toBe(false);
      expect(canTransition("refunded", "cancelled")).toBe(false);
    });
    it("rejected → anything (terminal)", () => {
      expect(canTransition("rejected", "approved")).toBe(false);
    });
    it("cancelled → anything (terminal)", () => {
      expect(canTransition("cancelled", "approved")).toBe(false);
    });
    it("received → cancelled (no take-back after item received)", () =>
      expect(canTransition("received", "cancelled")).toBe(false));
  });

  describe("assertTransition", () => {
    it("noop for same status", () => {
      expect(() => assertTransition("requested", "requested")).not.toThrow();
    });
    it("throws on forbidden", () => {
      expect(() => assertTransition("requested", "refunded")).toThrow(/forbidden/);
    });
    it("requires reason for rejected", () => {
      expect(() => assertTransition("requested", "rejected")).toThrow(/statusReason/);
      expect(() => assertTransition("requested", "rejected", "  ")).toThrow(/statusReason/);
      expect(() => assertTransition("requested", "rejected", "товар не вернули")).not.toThrow();
    });
  });

  describe("terminal/open classification", () => {
    it("refunded/rejected/cancelled are terminal", () => {
      expect(TERMINAL.has("refunded")).toBe(true);
      expect(TERMINAL.has("rejected")).toBe(true);
      expect(TERMINAL.has("cancelled")).toBe(true);
    });
    it("requested/approved/received are open (active dispute)", () => {
      expect(OPEN_STATUSES.has("requested")).toBe(true);
      expect(OPEN_STATUSES.has("approved")).toBe(true);
      expect(OPEN_STATUSES.has("received")).toBe(true);
    });
    it("terminal statuses are not open", () => {
      expect(OPEN_STATUSES.has("refunded")).toBe(false);
      expect(OPEN_STATUSES.has("rejected")).toBe(false);
    });
  });
});
