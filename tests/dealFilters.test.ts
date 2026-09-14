import type { Deal } from "../src/core/deal";
import {
  createDealMatcher,
  hasAnyDrmName,
  parseDrmNamesFromEnv,
  rejectDeal,
  savingsInRange,
} from "../src/core/filters";

function makeDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "deal-1",
    title: "Test Game",
    type: "game",
    hasOffer: true,
    url: "https://example.com",
    shopId: 61,
    shopName: "Steam",
    price: 9.99,
    regular: 19.99,
    currency: "USD",
    cut: 50,
    drmNames: ["Steam"],
    expiry: null,
    historicalLow: false,
    ...overrides,
  };
}

function expiryInHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

const baseCriteria = { minSavings: 30, maxSavings: 85 };

describe("dealFilters", () => {
  test("hasAnyDrmName passes when no drm names are required", () => {
    expect(hasAnyDrmName(makeDeal({ drmNames: ["Drm Free"] }), [])).toBe(true);
  });

  test("hasAnyDrmName checks configured drm names", () => {
    const steamDeal = makeDeal({ drmNames: ["Steam"] });
    const gogDeal = makeDeal({ drmNames: ["GOG"] });

    expect(hasAnyDrmName(steamDeal, ["Steam"])).toBe(true);
    expect(hasAnyDrmName(gogDeal, ["Steam"])).toBe(false);
    expect(hasAnyDrmName(gogDeal, ["GOG"])).toBe(true);
  });

  test("createDealMatcher omits drm check when requiredDrmNames is empty", () => {
    const matcher = createDealMatcher({
      ...baseCriteria,
      requiredDrmNames: [],
    });
    expect(matcher(makeDeal({ drmNames: ["Drm Free"] }))).toBe(true);
  });

  test("createDealMatcher applies configured drm names", () => {
    const steamMatcher = createDealMatcher({
      ...baseCriteria,
      requiredDrmNames: ["Steam"],
    });
    const gogMatcher = createDealMatcher({
      ...baseCriteria,
      requiredDrmNames: ["GOG"],
    });

    const steamDeal = makeDeal({ drmNames: ["Steam"] });
    const gogDeal = makeDeal({ drmNames: ["GOG"] });

    expect(steamMatcher(steamDeal)).toBe(true);
    expect(steamMatcher(gogDeal)).toBe(false);
    expect(gogMatcher(gogDeal)).toBe(true);
  });

  test("savingsInRange enforces bounds", () => {
    const deal = makeDeal();
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
      ...baseCriteria,
      minHoursUntilExpiry: 48,
    });
    expect(matcher(makeDeal())).toBe(true);
  });

  test("MIN_HOURS_UNTIL_EXPIRY=0 allows a deal that expires in 1h", () => {
    const matcher = createDealMatcher({
      ...baseCriteria,
      minHoursUntilExpiry: 0,
    });
    expect(matcher(makeDeal({ expiry: expiryInHours(1) }))).toBe(true);
  });

  test("48h window rejects a deal that expires in 1h", () => {
    const matcher = createDealMatcher({
      ...baseCriteria,
      minHoursUntilExpiry: 48,
    });
    expect(matcher(makeDeal({ expiry: expiryInHours(1) }))).toBe(false);
  });

  test("rating 90 / 10k reviews passes MIN_RATING 70 and MIN_REVIEW_COUNT 100", () => {
    const matcher = createDealMatcher({
      ...baseCriteria,
      minRating: 70,
      minReviewCount: 100,
    });
    expect(
      matcher(
        makeDeal({
          reviews: [{ source: "Steam", score: 90, count: 10_000 }],
        }),
      ),
    ).toBe(true);
  });

  test("rating 10 fails MIN_RATING 70", () => {
    const matcher = createDealMatcher({
      ...baseCriteria,
      minRating: 70,
      minReviewCount: 100,
    });
    expect(
      matcher(
        makeDeal({
          reviews: [{ source: "Steam", score: 10, count: 10_000 }],
        }),
      ),
    ).toBe(false);
  });

  test("missing reviews fail when a min rating is set", () => {
    const matcher = createDealMatcher({
      ...baseCriteria,
      minRating: 70,
    });
    expect(matcher(makeDeal())).toBe(false);
  });

  test("rejectDeal returns a reason for each filter", () => {
    expect(rejectDeal(makeDeal({ hasOffer: false }), baseCriteria)).toBe(
      "missing-deal",
    );
    expect(rejectDeal(makeDeal({ type: "dlc" }), baseCriteria)).toBe("type");
    expect(rejectDeal(makeDeal({ cut: 10 }), baseCriteria)).toBe("cut");
    expect(
      rejectDeal(makeDeal({ drmNames: ["GOG"] }), {
        ...baseCriteria,
        requiredDrmNames: ["Steam"],
      }),
    ).toBe("drm");
    expect(
      rejectDeal(makeDeal({ expiry: expiryInHours(1) }), {
        ...baseCriteria,
        minHoursUntilExpiry: 48,
      }),
    ).toBe("expiry");
    expect(rejectDeal(makeDeal(), { ...baseCriteria, minRating: 70 })).toBe(
      "rating",
    );
    expect(
      rejectDeal(
        makeDeal({
          reviews: [{ source: "Steam", score: 90, count: 1 }],
        }),
        { ...baseCriteria, minReviewCount: 100 },
      ),
    ).toBe("reviews");
    expect(rejectDeal(makeDeal(), baseCriteria)).toBeNull();
    expect(
      rejectDeal(makeDeal({ price: 0, cut: 100 }), {
        ...baseCriteria,
        includeFree: true,
        minPrice: 0,
      }),
    ).toBeNull();
    expect(rejectDeal(makeDeal({ price: 0, cut: 100 }), baseCriteria)).toBe(
      "cut",
    );
    expect(
      rejectDeal(makeDeal({ price: 5 }), { ...baseCriteria, minPrice: 10 }),
    ).toBe("price");
  });
});
