import type { Deal } from "../src/core/deal";
import { DISCORD_MAX_EMBEDS_PER_MESSAGE, postDealBatches } from "../src/posting";

function deal(id: string): Deal {
  return {
    id,
    title: id,
    type: "game",
    hasOffer: true,
    url: "https://example.com",
    shopId: 61,
    shopName: "Steam",
    price: 1,
    regular: 2,
    currency: "USD",
    cut: 50,
    drmNames: ["Steam"],
    expiry: null,
    historicalLow: false,
  };
}

describe("postDealBatches", () => {
  test("marks each successful batch and stops if send throws", async () => {
    const posted: string[][] = [];
    const deals = Array.from({ length: DISCORD_MAX_EMBEDS_PER_MESSAGE + 1 }, (_, i) =>
      deal(String(i + 1)),
    );
    let calls = 0;

    await expect(
      postDealBatches(
        deals,
        async () => {
          calls += 1;
          if (calls === 2) {
            throw new Error("discord down");
          }
        },
        (batch) => {
          posted.push(batch.map((item) => item.id));
        },
      ),
    ).rejects.toThrow("discord down");

    expect(posted).toEqual([
      deals.slice(0, DISCORD_MAX_EMBEDS_PER_MESSAGE).map((item) => item.id),
    ]);
  });
});
