import type { Deal } from "../src/core/deal";
import { rejectDeal } from "../src/core/filters";
import { DealCollector } from "../src/services/dealCollector";

function makeDeal(overrides: Partial<Deal> & { id: string }): Deal {
  return {
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

const steamReject = (deal: Deal) =>
  rejectDeal(deal, {
    minSavings: 30,
    maxSavings: 85,
    requiredDrmNames: ["Steam"],
  });

describe("DealCollector", () => {
  test("accepts deal matching filters not in postedIds", () => {
    const collector = new DealCollector(5, new Set(), steamReject);
    const deal = makeDeal({ id: "deal-1" });

    expect(collector.accept(deal)).toBe(true);
    expect(collector.results).toHaveLength(1);
    expect(collector.stats.accepted).toBe(1);
  });

  test("rejects deal in postedIds", () => {
    const collector = new DealCollector(5, new Set(["deal-1"]), steamReject);
    const deal = makeDeal({ id: "deal-1" });

    expect(collector.accept(deal)).toBe(false);
    expect(collector.results).toHaveLength(0);
    expect(collector.stats.skippedPosted).toBe(1);
  });

  test("rejects duplicate within same run", () => {
    const collector = new DealCollector(5, new Set(), steamReject);
    const deal = makeDeal({ id: "deal-1" });

    expect(collector.accept(deal)).toBe(true);
    expect(collector.accept(deal)).toBe(false);
    expect(collector.results).toHaveLength(1);
    expect(collector.stats.skippedDuplicate).toBe(1);
  });

  test("stops accepting after targetCount reached", () => {
    const collector = new DealCollector(2, new Set(), steamReject);

    collector.accept(makeDeal({ id: "deal-1" }));
    collector.accept(makeDeal({ id: "deal-2" }));
    collector.accept(makeDeal({ id: "deal-3" }));

    expect(collector.results).toHaveLength(2);
    expect(collector.needsMore).toBe(false);
  });

  test("rejects non-matching filter deals and counts the reason", () => {
    const collector = new DealCollector(5, new Set(), steamReject);
    const deal = makeDeal({ id: "deal-1", drmNames: ["Drm Free"] });

    expect(collector.accept(deal)).toBe(false);
    expect(collector.stats.skippedFilter).toBe(1);
    expect(collector.stats.rejects.drm).toBe(1);
    expect(collector.results).toHaveLength(0);
  });
});

describe("DealCollector page stream", () => {
  test("stops early once target is reached mid-stream", () => {
    const collector = new DealCollector(2, new Set(), steamReject);
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
    expect(collector.stats.rejects.type).toBe(1);
  });

  test("same id different shop both accepted", () => {
    const collector = new DealCollector(5, new Set(), steamReject);

    expect(collector.accept(makeDeal({ id: "deal-1", shopId: 61 }))).toBe(true);
    expect(collector.accept(makeDeal({ id: "deal-1", shopId: 35 }))).toBe(true);
    expect(collector.results).toHaveLength(2);
    expect(collector.stats.skippedDuplicate).toBe(0);
  });
});
