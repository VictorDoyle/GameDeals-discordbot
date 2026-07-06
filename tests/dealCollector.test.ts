import { DealCollector } from "../src/services/dealCollector";
import { createDealMatcher } from "../src/services/dealFilters";
import type { ITADDeal } from "../src/types";

function makeDeal(overrides: {
  id: string;
  type?: string | null;
  cut?: number;
  drm?: Array<{ id: number; name: string }>;
  expiry?: string | null;
}): ITADDeal {
  return {
    id: overrides.id,
    slug: "test-game",
    title: "Test Game",
    type: overrides.type ?? "game",
    mature: false,
    assets: {},
    deal: {
      shop: { id: 61, name: "Steam" },
      price: { amount: 9.99, amountInt: 999, currency: "USD" },
      regular: { amount: 19.99, amountInt: 1999, currency: "USD" },
      cut: overrides.cut ?? 50,
      voucher: null,
      storeLow: { amount: 9.99, amountInt: 999, currency: "USD" },
      historyLow: { amount: 9.99, amountInt: 999, currency: "USD" },
      flag: null,
      drm: overrides.drm ?? [{ id: 1, name: "Steam" }],
      platforms: [{ id: 1, name: "Windows" }],
      timestamp: "2024-01-01T00:00:00+01:00",
      expiry: overrides.expiry ?? null,
      url: "https://example.com",
    },
  };
}

const steamMatcher = createDealMatcher({
  minSavings: 30,
  maxSavings: 85,
  requiredDrmNames: ["Steam"],
});

describe("DealCollector", () => {
  test("accepts deal matching filters not in postedIds", () => {
    const collector = new DealCollector(5, new Set(), steamMatcher);
    const deal = makeDeal({ id: "deal-1" });

    expect(collector.accept(deal)).toBe(true);
    expect(collector.results).toHaveLength(1);
    expect(collector.stats.accepted).toBe(1);
  });

  test("rejects deal in postedIds", () => {
    const collector = new DealCollector(
      5,
      new Set(["deal-1"]),
      steamMatcher,
    );
    const deal = makeDeal({ id: "deal-1" });

    expect(collector.accept(deal)).toBe(false);
    expect(collector.results).toHaveLength(0);
    expect(collector.stats.skippedPosted).toBe(1);
  });

  test("rejects duplicate within same run", () => {
    const collector = new DealCollector(5, new Set(), steamMatcher);
    const deal = makeDeal({ id: "deal-1" });

    expect(collector.accept(deal)).toBe(true);
    expect(collector.accept(deal)).toBe(false);
    expect(collector.results).toHaveLength(1);
    expect(collector.stats.skippedDuplicate).toBe(1);
  });

  test("stops accepting after targetCount reached", () => {
    const collector = new DealCollector(2, new Set(), steamMatcher);

    collector.accept(makeDeal({ id: "deal-1" }));
    collector.accept(makeDeal({ id: "deal-2" }));
    collector.accept(makeDeal({ id: "deal-3" }));

    expect(collector.results).toHaveLength(2);
    expect(collector.needsMore).toBe(false);
  });

  test("rejects non-matching filter deals", () => {
    const collector = new DealCollector(5, new Set(), steamMatcher);
    const deal = makeDeal({ id: "deal-1", drm: [{ id: 1000, name: "Drm Free" }] });

    expect(collector.accept(deal)).toBe(false);
    expect(collector.stats.skippedFilter).toBe(1);
    expect(collector.results).toHaveLength(0);
  });
});

describe("DealCollector page stream", () => {
  test("stops early once target is reached mid-stream", () => {
    const collector = new DealCollector(2, new Set(), steamMatcher);
    const pageOne = [
      makeDeal({ id: "deal-1" }),
      makeDeal({ id: "skip-dlc", type: "dlc" }),
      makeDeal({ id: "deal-2" }),
      makeDeal({ id: "deal-3" }),
    ];

    for (const deal of pageOne) {
      collector.accept(deal);
      if (!collector.needsMore) {
        break;
      }
    }

    expect(collector.results).toHaveLength(2);
    expect(collector.needsMore).toBe(false);
    expect(collector.results.map((deal) => deal.id)).toEqual([
      "deal-1",
      "deal-2",
    ]);
  });
});
