import { describe, expect, it } from "vitest";

import { isIpInYooKassaAllowlist, YOOKASSA_ALLOWLIST } from "../ip-allowlist";

describe("isIpInYooKassaAllowlist (055 FR-5530)", () => {
  describe("IPv4 CIDR matching", () => {
    it("matches 185.71.76.0/27 — network address", () => {
      expect(isIpInYooKassaAllowlist("185.71.76.0")).toBe(true);
    });
    it("matches 185.71.76.0/27 — last address in range (32 ips, .31)", () => {
      expect(isIpInYooKassaAllowlist("185.71.76.31")).toBe(true);
    });
    it("rejects address outside /27 (.32 → next subnet)", () => {
      expect(isIpInYooKassaAllowlist("185.71.76.32")).toBe(false);
    });
    it("matches 77.75.153.0/25", () => {
      expect(isIpInYooKassaAllowlist("77.75.153.50")).toBe(true);
      expect(isIpInYooKassaAllowlist("77.75.153.127")).toBe(true);
    });
    it("rejects address outside /25 (.128 → next subnet)", () => {
      expect(isIpInYooKassaAllowlist("77.75.153.128")).toBe(false);
    });
    it("matches single-host /32", () => {
      expect(isIpInYooKassaAllowlist("77.75.156.11")).toBe(true);
      expect(isIpInYooKassaAllowlist("77.75.156.35")).toBe(true);
    });
    it("rejects nearby but distinct /32 host", () => {
      expect(isIpInYooKassaAllowlist("77.75.156.12")).toBe(false);
    });
    it("rejects completely unrelated IPv4", () => {
      expect(isIpInYooKassaAllowlist("8.8.8.8")).toBe(false);
      expect(isIpInYooKassaAllowlist("192.168.1.1")).toBe(false);
    });
  });

  describe("IPv4-mapped IPv6", () => {
    it("strips ::ffff: prefix and matches v4 range", () => {
      expect(isIpInYooKassaAllowlist("::ffff:185.71.76.5")).toBe(true);
    });
    it("rejects ::ffff-mapped IPv4 outside ranges", () => {
      expect(isIpInYooKassaAllowlist("::ffff:8.8.8.8")).toBe(false);
    });
  });

  describe("IPv6 CIDR matching (2a02:5180::/32)", () => {
    it("matches host inside /32", () => {
      expect(isIpInYooKassaAllowlist("2a02:5180:1234::1")).toBe(true);
      expect(isIpInYooKassaAllowlist("2a02:5180::1")).toBe(true);
    });
    it("rejects host with different /32 prefix", () => {
      expect(isIpInYooKassaAllowlist("2a02:5181::1")).toBe(false);
      expect(isIpInYooKassaAllowlist("::1")).toBe(false);
    });
  });

  describe("invalid input", () => {
    it("rejects null / undefined / empty", () => {
      expect(isIpInYooKassaAllowlist(null)).toBe(false);
      expect(isIpInYooKassaAllowlist(undefined)).toBe(false);
      expect(isIpInYooKassaAllowlist("")).toBe(false);
      expect(isIpInYooKassaAllowlist("   ")).toBe(false);
    });
    it("rejects malformed IPv4", () => {
      expect(isIpInYooKassaAllowlist("185.71.76")).toBe(false);
      expect(isIpInYooKassaAllowlist("185.71.76.256")).toBe(false);
      expect(isIpInYooKassaAllowlist("not.an.ip.addr")).toBe(false);
    });
    it("rejects non-string types", () => {
      expect(isIpInYooKassaAllowlist(123 as unknown as string)).toBe(false);
    });
  });

  describe("metadata export", () => {
    it("exposes CIDR lists for tests/observability", () => {
      expect(YOOKASSA_ALLOWLIST.v4.length).toBeGreaterThan(0);
      expect(YOOKASSA_ALLOWLIST.v6.length).toBeGreaterThan(0);
      expect(YOOKASSA_ALLOWLIST.v4).toContain("185.71.76.0/27");
    });
  });
});
