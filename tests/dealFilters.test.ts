import {
  createDealMatcher,
  hasAnyDrmName,
  parseDrmNamesFromEnv,
  savingsInRange,
} from "../src/services/dealFilters";
import type { ITADDeal } from "../src/types";

function makeDeal(
  drm: Array<{ id: number; name: string }> = [{ id: 1, name: "Steam" }],
  extras: { expiry?: string | null; reviews?: ITADDeal["reviews"] } = {},
): ITADDeal {
  return {
    id: "deal-1",
    slug: "test-game",
    title: "Test Game",
    type: "game",
    mature: false,
    assets: {},
    deal: {
      shop: { id: 61, name: "Steam" },
      price: { amount: 9.99, amountInt: 999, currency: "USD" },
      regular: { amount: 19.99, amountInt: 1999, currency: "USD" },
      cut: 50,
      voucher: null,
      storeLow: { amount: 9.99, amountInt: 999, currency: "USD" },
      historyLow: { amount: 9.99, amountInt: 999, currency: "USD" },
      flag: null,
      drm,
      platforms: [{ id: 1, name: "Windows" }],
      timestamp: "2024-01-01T00:00:00+01:00",
      expiry: extras.expiry ?? null,
      url: "https://example.com",
    },
    reviews: extras.reviews,
  };
}

function expiryInHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

describe("dealFilters", () => {
  test("hasAnyDrmName passes when no drm names are required", () => {
    const deal = makeDeal([{ id: 1000, name: "Drm Free" }]);
    expect(hasAnyDrmName(deal, [])).toBe(true);
  });

  test("hasAnyDrmName checks configured drm names", () => {
    const steamDeal = makeDeal([{ id: 1, name: "Steam" }]);
    const gogDeal = makeDeal([{ id: 2, name: "GOG" }]);

    expect(hasAnyDrmName(steamDeal, ["Steam"])).toBe(true);
    expect(hasAnyDrmName(gogDeal, ["Steam"])).toBe(false);
    expect(hasAnyDrmName(gogDeal, ["GOG"])).toBe(true);
  });

  test("createDealMatcher omits drm check when requiredDrmNames is empty", () => {
    const matcher = createDealMatcher({
      minSavings: 30,
      maxSavings: 85,
      requiredDrmNames: [],
    });
    const deal = makeDeal([{ id: 1000, name: "Drm Free" }]);

    expect(matcher(deal)).toBe(true);
  });

  test("createDealMatcher applies configured drm names", () => {
    const steamMatcher = createDealMatcher({
      minSavings: 30,
      maxSavings: 85,
      requiredDrmNames: ["Steam"],
    });
    const gogMatcher = createDealMatcher({
      minSavings: 30,
      maxSavings: 85,
      requiredDrmNames: ["GOG"],
    });

    const steamDeal = makeDeal([{ id: 1, name: "Steam" }]);
    const gogDeal = makeDeal([{ id: 2, name: "GOG" }]);

    expect(steamMatcher(steamDeal)).toBe(true);
    expect(steamMatcher(gogDeal)).toBe(false);
    expect(gogMatcher(gogDeal)).toBe(true);
  });

  test("savingsInRange enforces bounds", () => {
    const deal = makeDeal([{ id: 1, name: "Steam" }]);
    expect(savingsInRange(deal, 30, 85)).toBe(true);
    expect(savingsInRange(deal, 60, 85)).toBe(false);
  });

  test("parseDrmNamesFromEnv splits comma-separated values", () => {
    expect(parseDrmNamesFromEnv("Steam, GOG")).toEqual(["Steam", "GOG"]);
    expect(parseDrmNamesFromEnv("")).toEqual([]);
    expect(parseDrmNamesFromEnv(undefined)).toEqual([]);
  });

  test("expiresAfterWindow allows missing expiry", () => {
    const matcher = createDealMatcher({
      minSavings: 30,
      maxSavings: 85,
      minHoursUntilExpiry: 48,
    });
    expect(matcher(makeDeal())).toBe(true);
  });

  test("MIN_HOURS_UNTIL_EXPIRY=0 allows a deal that expires in 1h", () => {
    const matcher = createDealMatcher({
      minSavings: 30,
      maxSavings: 85,
      minHoursUntilExpiry: 0,
    });
    expect(
      matcher(
        makeDeal([{ id: 1, name: "Steam" }], { expiry: expiryInHours(1) }),
      ),
    ).toBe(true);
  });

  test("48h window rejects a deal that expires in 1h", () => {
    const matcher = createDealMatcher({
      minSavings: 30,
      maxSavings: 85,
      minHoursUntilExpiry: 48,
    });
    expect(
      matcher(
        makeDeal([{ id: 1, name: "Steam" }], { expiry: expiryInHours(1) }),
      ),
    ).toBe(false);
  });

  test("rating 90 / 10k reviews passes MIN_RATING 70 and MIN_REVIEW_COUNT 100", () => {
    const matcher = createDealMatcher({
      minSavings: 30,
      maxSavings: 85,
      minRating: 70,
      minReviewCount: 100,
    });
    const deal = makeDeal([{ id: 1, name: "Steam" }], {
      reviews: [{ source: "Steam", score: 90, count: 10_000 }],
    });
    expect(matcher(deal)).toBe(true);
  });

  test("rating 10 fails MIN_RATING 70", () => {
    const matcher = createDealMatcher({
      minSavings: 30,
      maxSavings: 85,
      minRating: 70,
      minReviewCount: 100,
    });
    const deal = makeDeal([{ id: 1, name: "Steam" }], {
      reviews: [{ source: "Steam", score: 10, count: 10_000 }],
    });
    expect(matcher(deal)).toBe(false);
  });

  test("missing reviews fail when a min rating is set", () => {
    const matcher = createDealMatcher({
      minSavings: 30,
      maxSavings: 85,
      minRating: 70,
    });
    expect(matcher(makeDeal())).toBe(false);
  });
});
