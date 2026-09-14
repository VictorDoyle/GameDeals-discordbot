import { mapItadDeal } from "../src/core/deal";
import { api, getCachedDeals } from "./fixtures/itadFixture";

describe("Embed formatting", () => {
  test("formatDealEmbed returns embed with expected structure and images (uses cached data)", async () => {
    const deals = (await getCachedDeals()).map(mapItadDeal);
    expect(deals.length).toBeGreaterThan(0);

    const deal = deals.find((d) => d.thumbnail || d.image) ?? deals[0];
    const embed = api.formatDealEmbed(deal);
    const json = embed.toJSON();

    expect(json.title).toBe(deal.title);
    expect(json.url).toBe(deal.url);

    const fieldNames = (json.fields || []).map((f) => f.name);
    const required = ["Price", "Discount", "Store"];
    for (const r of required) expect(fieldNames).toContain(r);

    if (deal.historicalLow) {
      const desc = json.description || "";
      expect(String(desc).toLowerCase()).toContain("historical low");
    }

    if (deal.thumbnail) {
      expect(String(json.thumbnail?.url || "")).toContain(deal.thumbnail);
    } else if (deal.image) {
      expect(String(json.image?.url || "")).toContain(deal.image);
    }
  });
});
