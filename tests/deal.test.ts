import { dealBadges, mapGiveaway, mapItadDeal } from "../src/core/deal";
import type { ITADDeal } from "../src/types";

function rawDeal(
  overrides: {
    omitDeal?: boolean;
    flag?: string | null;
    cut?: number;
  } = {},
): ITADDeal {
  return {
    id: "deal-1",
    slug: "test-game",
    title: "Test Game",
    type: "game",
    mature: false,
    assets: { boxart: "https://example.com/box.jpg" },
    deal: overrides.omitDeal
      ? undefined
      : {
          shop: { id: 61, name: "Steam" },
          price: { amount: 0, amountInt: 0, currency: "USD" },
          regular: { amount: 19.99, amountInt: 1999, currency: "USD" },
          cut: overrides.cut ?? 50,
          voucher: null,
          storeLow: { amount: 0, amountInt: 0, currency: "USD" },
          historyLow: { amount: 0, amountInt: 0, currency: "USD" },
          flag: overrides.flag ?? null,
          drm: [{ id: 1, name: "Steam" }],
          platforms: [{ id: 1, name: "Windows" }],
          timestamp: "2024-01-01T00:00:00+00:00",
          expiry: null,
          url: "https://example.com",
        },
  };
}

describe("mapItadDeal", () => {
  test("sets historicalLow when flag is H", () => {
    expect(mapItadDeal(rawDeal({ flag: "H" })).historicalLow).toBe(true);
    expect(mapItadDeal(rawDeal({ flag: null })).historicalLow).toBe(false);
  });

  test("maps a missing deal to hasOffer false", () => {
    const mapped = mapItadDeal(rawDeal({ omitDeal: true }));
    expect(mapped.hasOffer).toBe(false);
    expect(mapped.cut).toBe(0);
    expect(mapped.url).toBe("");
  });

  test("keeps a $0 cut", () => {
    const mapped = mapItadDeal(rawDeal({ cut: 0 }));
    expect(mapped.hasOffer).toBe(true);
    expect(mapped.cut).toBe(0);
    expect(mapped.price).toBe(0);
  });
});

describe("mapGiveaway", () => {
  test("maps a giveaway to a $0 / 100% deal", () => {
    const mapped = mapGiveaway({
      id: "018d937f-game-free-game",
      title: "Free Game",
      type: "game",
      shop: { id: 61, name: "Steam" },
      url: "https://example.com/free",
      expiry: "2099-01-01T00:00:00+00:00",
    });
    expect(mapped.price).toBe(0);
    expect(mapped.cut).toBe(100);
    expect(mapped.drmNames).toEqual([]);
  });
});

describe("dealBadges", () => {
  test("near-low within 5% badges; 20% off history low does not", () => {
    expect(
      dealBadges({
        id: "a",
        title: "a",
        type: "game",
        hasOffer: true,
        url: "",
        shopId: 61,
        shopName: "Steam",
        price: 10.5,
        regular: 20,
        currency: "USD",
        cut: 47,
        drmNames: [],
        expiry: null,
        historicalLow: false,
        historyLow: 10,
      }),
    ).toEqual(["near-low"]);

    expect(
      dealBadges({
        id: "b",
        title: "b",
        type: "game",
        hasOffer: true,
        url: "",
        shopId: 61,
        shopName: "Steam",
        price: 12,
        regular: 20,
        currency: "USD",
        cut: 40,
        drmNames: [],
        expiry: null,
        historicalLow: false,
        historyLow: 10,
      }),
    ).toEqual([]);
  });
});
