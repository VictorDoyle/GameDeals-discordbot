import { mapItadDeal } from "../src/core/deal";
import { filterDeals } from "../src/core/filters";
import { getCachedDeals } from "./fixtures/itadFixture";

describe("Filtering logic", () => {
  test("filterDeals enforces savings and Steam DRM and expiry window (uses cached data)", async () => {
    const deals = (await getCachedDeals()).map(mapItadDeal);
    const minSavings = 30;
    const maxSavings = 85;
    const filterCriteria = {
      minSavings,
      maxSavings,
      requiredDrmNames: ["Steam"],
    };

    const filtered = filterDeals(deals, filterCriteria);

    const now = Date.now();
    const EXPIRY_WINDOW_MS = 48 * 60 * 60 * 1000;
    for (const d of filtered) {
      if (d.expiry) {
        const expiryTime = Date.parse(d.expiry);
        expect(
          isNaN(expiryTime) || expiryTime - now > EXPIRY_WINDOW_MS,
        ).toBeTruthy();
      }
    }

    expect(filtered.length).toBeGreaterThan(0);

    for (const d of filtered) {
      expect(d.cut).toBeGreaterThanOrEqual(minSavings);
      expect(d.cut).toBeLessThanOrEqual(maxSavings);
      expect(d.drmNames).toContain("Steam");
    }
  });
});
