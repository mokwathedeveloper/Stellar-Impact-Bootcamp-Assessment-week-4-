/**
 * stellar.utils.test.js
 *
 * Unit tests for the pure helper functions in stellar.js.
 * Freighter wallet calls are NOT tested here — they require the browser
 * extension and are covered by the manual test plan (TC-014 … TC-017).
 */

import { describe, it, expect } from "vitest";
import { shortenKey } from "../utils/stellar";

const FULL_KEY = "GDPTMWBY6RCDEOCQ2WHUG2V7WWCXXIP7T56E46DTF2WZ3MCY47AGZICR";

describe("shortenKey", () => {
  it("shortens a full Stellar public key with default 6-char ends", () => {
    // GDPTMWBY6RCDEOCQ2WHUG2V7WWCXXIP7T56E46DTF2WZ3MCY47AGZICR
    // first 6 = GDPTMW, last 6 = AGZICR
    const result = shortenKey(FULL_KEY);
    expect(result).toBe("GDPTMW…AGZICR");
  });

  it("uses the custom chars parameter", () => {
    // first 4 = GDPT, last 4 = ZICR
    const result = shortenKey(FULL_KEY, 4);
    expect(result).toBe("GDPT…ZICR");
  });

  it("contains the ellipsis separator", () => {
    expect(shortenKey(FULL_KEY)).toContain("…");
  });

  it("starts with the first N characters of the key", () => {
    expect(shortenKey(FULL_KEY, 6)).toMatch(/^GDPTMW/);
  });

  it("ends with the last N characters of the key", () => {
    expect(shortenKey(FULL_KEY, 6)).toMatch(/AGZICR$/);
  });

  it("returns the original key unchanged if it is shorter than 2×chars", () => {
    const shortKey = "GABC";
    expect(shortenKey(shortKey, 6)).toBe("GABC");
  });

  it("returns the key unchanged for null input", () => {
    expect(shortenKey(null)).toBe(null);
  });

  it("returns the key unchanged for empty string", () => {
    expect(shortenKey("")).toBe("");
  });

  it("does not include middle characters of the key", () => {
    const result = shortenKey(FULL_KEY, 6);
    expect(result).not.toContain("BY6RCD");
    expect(result).not.toContain("WZ3MCY");
  });
});
