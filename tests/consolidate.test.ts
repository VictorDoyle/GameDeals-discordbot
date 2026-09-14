import { consolidateDeals } from "../src/core/consolidate";
import type { Deal } from "../src/core/deal";

function shopDeal(
  shopId: number,
  shopName: string,
  price: number,
  cut = 50,
): Deal {
  return {
    id: "same-game",
    title: "Same Game",
    type: "game",
    hasOffer: true,
    url: "https://example.com",
    shopId,
    shopName,
    price,
    regular: 20,
    currency: "USD",
    cut,
    drmNames: ["Steam"],
    expiry: null,
    historicalLow: false,
  };
}

describe("consolidateDeals", () => {
  test("five shops collapse to one deal; cheapest wins", () => {
    const deals = [
      shopDeal(61, "Steam", 12.99, 35),
      shopDeal(35, "GOG", 9.99, 50),
      shopDeal(6, "Fanatical", 11.0, 45),
      shopDeal(3, "Humble", 10.5, 47),
      shopDeal(16, "GreenManGaming", 13.0, 30),
    ];

    const [winner] = consolidateDeals(deals);
    expect(winner.shopName).toBe("GOG");
    expect(winner.price).toBe(9.99);
    expect(winner.alsoAt).toEqual([
      { shopName: "Humble", price: 10.5, currency: "USD" },
      { shopName: "Fanatical", price: 11.0, currency: "USD" },
      { shopName: "Steam", price: 12.99, currency: "USD" },
      { shopName: "GreenManGaming", price: 13.0, currency: "USD" },
    ]);
  });

  test("single-shop deal is unchanged", () => {
    const deal = shopDeal(61, "Steam", 7.49);
    expect(consolidateDeals([deal])).toEqual([deal]);
  });
});
