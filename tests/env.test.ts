import { parseIntegerEnv, parseShopIds } from "../src/env";

describe("parseIntegerEnv", () => {
  test("uses fallback when unset", () => {
    expect(parseIntegerEnv("DEAL_LIMIT", undefined, 50, 1)).toBe(50);
  });

  test("parses a valid integer", () => {
    expect(parseIntegerEnv("DEAL_LIMIT", "10", 50, 1)).toBe(10);
  });

  test("rejects non-integers", () => {
    expect(() => parseIntegerEnv("DEAL_LIMIT", "foo-bar", 50, 1)).toThrow(
      'DEAL_LIMIT must be an integer >= 1, got "foo-bar"',
    );
  });

  test("rejects values below min", () => {
    expect(() => parseIntegerEnv("DEAL_LIMIT", "0", 50, 1)).toThrow(
      'DEAL_LIMIT must be an integer >= 1, got "0"',
    );
  });

  test("allows zero", () => {
    expect(parseIntegerEnv("MIN_HOURS_UNTIL_EXPIRY", "0", 48, 0)).toBe(0);
  });
});

describe("parseShopIds", () => {
  test("uses default shops when unset", () => {
    expect(parseShopIds(undefined)).toEqual([61, 35, 6, 3]);
  });

  test("parses a comma-separated list", () => {
    expect(parseShopIds("61, 35")).toEqual([61, 35]);
  });

  test("rejects an empty list", () => {
    expect(() => parseShopIds("")).toThrow(
      'SHOP_IDS must be a comma-separated list of positive integers, got ""',
    );
  });

  test("rejects non-integer ids", () => {
    expect(() => parseShopIds("61,steam")).toThrow(
      'SHOP_IDS must be a comma-separated list of positive integers, got "61,steam"',
    );
  });
});
