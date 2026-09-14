import type { ITADDeal } from "../src/types";
import { api, getCachedDeals } from "./fixtures/itadFixture";

describe("Embed formatting", () => {
  test("formatDealEmbed returns embed with expected structure and images (uses cached data)", async () => {
    const deals = await getCachedDeals();
    expect(deals.length).toBeGreaterThan(0);

    let candidate: ITADDeal | null = null;
    for (const d of deals) {
      const assets = d.assets || {};
      if (assets.boxart || assets.banner600) {
        candidate = d;
        break;
      }
    }

    const deal = candidate || deals[0];
    const embed = api.formatDealEmbed(deal);
    const json = embed.toJSON();

    expect(json.title).toBe(deal.title);
    expect(json.url).toBe(deal.deal.url);

    const fieldNames = (json.fields || []).map((f) => f.name);
    const required = ["Price", "Discount", "Store"];
    for (const r of required) expect(fieldNames).toContain(r);

    if (deal.deal.flag === "H") {
      const desc = json.description || "";
      expect(String(desc).toLowerCase()).toContain("historical low");
    }

    const assets = deal.assets || {};
    const boxart = assets.boxart;
    const banner600 = assets.banner600 || assets.banner300;

    const hasThumbnail = !!json.thumbnail?.url;
    const hasImage = !!json.image?.url;

    if (boxart) {
      expect(
        hasThumbnail && String(json.thumbnail?.url || "").includes(boxart),
      ).toBeTruthy();
    } else if (banner600) {
      expect(
        hasImage && String(json.image?.url || "").includes(banner600),
      ).toBeTruthy();
    }
  });
});
