/**
 * contract.utils.test.js
 *
 * Unit tests for the pure formatting / parsing helpers in contract.js.
 * These functions have no external dependencies — no mocking required.
 */

import { describe, it, expect } from "vitest";
import {
  formatTokenAmount,
  parseTokenAmount,
  formatDeadline,
} from "../utils/contract";

// ─── formatTokenAmount ────────────────────────────────────────────────────────

describe("formatTokenAmount", () => {
  it("formats 1 XLM (10_000_000 stroops) correctly", () => {
    expect(formatTokenAmount(10_000_000n)).toBe("1.0");
  });

  it("formats 0 stroops as '0.0'", () => {
    expect(formatTokenAmount(0n)).toBe("0.0");
  });

  it("formats sub-unit amounts correctly", () => {
    expect(formatTokenAmount(5_500_000n)).toBe("0.55");
  });

  it("formats large amounts correctly", () => {
    expect(formatTokenAmount(1_000_000_000n)).toBe("100.0");
  });

  it("formats amounts with full decimal precision", () => {
    expect(formatTokenAmount(1n)).toBe("0.0000001");
  });

  it("handles numeric input (not just BigInt) without throwing", () => {
    expect(() => formatTokenAmount(10_000_000)).not.toThrow();
  });

  it("handles null gracefully by returning '0'", () => {
    expect(formatTokenAmount(null)).toBe("0");
  });
});

// ─── parseTokenAmount ─────────────────────────────────────────────────────────

describe("parseTokenAmount", () => {
  it("parses '1.0' to 10_000_000n", () => {
    expect(parseTokenAmount("1.0")).toBe(10_000_000n);
  });

  it("parses '0' to 0n", () => {
    expect(parseTokenAmount("0")).toBe(0n);
  });

  it("parses '0.5' to 5_000_000n", () => {
    expect(parseTokenAmount("0.5")).toBe(5_000_000n);
  });

  it("parses '100' (no decimals) correctly", () => {
    expect(parseTokenAmount("100")).toBe(1_000_000_000n);
  });

  it("parses maximum 7 decimal places (1 stroop)", () => {
    expect(parseTokenAmount("0.0000001")).toBe(1n);
  });

  it("truncates past 7 decimal places without throwing", () => {
    // Only 7 decimal places are significant; extra digits are dropped
    expect(parseTokenAmount("1.00000001")).toBe(10_000_000n);
  });

  it("is the inverse of formatTokenAmount for whole amounts", () => {
    const raw = 25_000_000n;
    expect(parseTokenAmount(formatTokenAmount(raw))).toBe(raw);
  });

  it("is the inverse of formatTokenAmount for fractional amounts", () => {
    const raw = 7_500_000n;
    expect(parseTokenAmount(formatTokenAmount(raw))).toBe(raw);
  });
});

// ─── formatDeadline ───────────────────────────────────────────────────────────

describe("formatDeadline", () => {
  it("returns 'Expired' for a timestamp in the past", () => {
    const past = Math.floor(Date.now() / 1000) - 100;
    expect(formatDeadline(past)).toBe("Expired");
  });

  it("returns 'Expired' for a timestamp exactly equal to now", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(formatDeadline(now)).toBe("Expired");
  });

  it("includes seconds for a near-future deadline", () => {
    const nearFuture = Math.floor(Date.now() / 1000) + 45;
    expect(formatDeadline(nearFuture)).toMatch(/\d+s/);
  });

  it("includes minutes and seconds for a deadline a few minutes away", () => {
    const fewMinutes = Math.floor(Date.now() / 1000) + 125;
    const result = formatDeadline(fewMinutes);
    expect(result).toMatch(/\d+m/);
    expect(result).toMatch(/\d+s/);
  });

  it("includes hours for a deadline many hours away", () => {
    const manyHours = Math.floor(Date.now() / 1000) + 7200;
    expect(formatDeadline(manyHours)).toMatch(/\d+h/);
  });

  it("does not include hours when deadline is only minutes away", () => {
    const fewMinutes = Math.floor(Date.now() / 1000) + 90;
    expect(formatDeadline(fewMinutes)).not.toMatch(/h/);
  });
});
