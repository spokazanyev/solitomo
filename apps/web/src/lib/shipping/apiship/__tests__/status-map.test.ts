import { describe, it, expect } from "vitest";

import {
  isTerminalStatus,
  mapApiShipStatus,
  mapShipmentToOrderStatus,
  shouldUpgradeStatus,
} from "../status-map";

describe("mapApiShipStatus", () => {
  it("maps numeric provider codes to internal shipment statuses", () => {
    expect(mapApiShipStatus("1")).toBe("created");
    expect(mapApiShipStatus("3")).toBe("in_transit");
    expect(mapApiShipStatus("4")).toBe("in_transit");
    expect(mapApiShipStatus("5")).toBe("in_transit");
    expect(mapApiShipStatus("6")).toBe("at_point");
    expect(mapApiShipStatus("7")).toBe("delivered");
    expect(mapApiShipStatus("8")).toBe("returned");
    expect(mapApiShipStatus("9")).toBe("cancelled");
  });

  it("maps numeric input (not only string) and string aliases", () => {
    expect(mapApiShipStatus(7)).toBe("delivered");
    expect(mapApiShipStatus("DELIVERED")).toBe("delivered");
    expect(mapApiShipStatus("returned")).toBe("returned");
  });

  it("returns in_transit for unknown codes (no demotion)", () => {
    expect(mapApiShipStatus("unknown-future-status")).toBe("in_transit");
  });
});

describe("isTerminalStatus", () => {
  it("treats delivered, cancelled, returned as terminal", () => {
    expect(isTerminalStatus("delivered")).toBe(true);
    expect(isTerminalStatus("cancelled")).toBe(true);
    expect(isTerminalStatus("returned")).toBe(true);
  });

  it("non-terminal statuses return false", () => {
    expect(isTerminalStatus("in_transit")).toBe(false);
    expect(isTerminalStatus("created")).toBe(false);
    expect(isTerminalStatus("at_point")).toBe(false);
    expect(isTerminalStatus("none")).toBe(false);
  });
});

describe("shouldUpgradeStatus", () => {
  it("returns true when no current status set", () => {
    expect(shouldUpgradeStatus(undefined, "in_transit")).toBe(true);
  });

  it("allows upgrade in_transit → at_point", () => {
    expect(shouldUpgradeStatus("in_transit", "at_point")).toBe(true);
  });

  it("blocks downgrade from terminal delivered → in_transit", () => {
    expect(shouldUpgradeStatus("delivered", "in_transit")).toBe(false);
  });

  it("blocks downgrade by rank (at_point → in_transit)", () => {
    expect(shouldUpgradeStatus("at_point", "in_transit")).toBe(false);
  });
});

describe("mapShipmentToOrderStatus", () => {
  it("in_transit → shipped when current is paid", () => {
    expect(mapShipmentToOrderStatus("in_transit", "paid")).toBe("shipped");
  });

  it("no transition when already shipped", () => {
    expect(mapShipmentToOrderStatus("in_transit", "shipped")).toBe(null);
  });

  it("delivered → delivered", () => {
    expect(mapShipmentToOrderStatus("delivered", "shipped")).toBe("delivered");
  });

  it("cancelled/returned propagate", () => {
    expect(mapShipmentToOrderStatus("cancelled", "paid")).toBe("cancelled");
    expect(mapShipmentToOrderStatus("returned", "delivered")).toBe("returned");
  });
});
