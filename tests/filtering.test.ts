import { api, getCachedDeals } from "./fixtures/itadFixture";

describe("Filtering logic", () => {
  test("filterDeals enforces savings and Steam DRM and expiry window (uses cached data)", async () => {
    const deals = await getCachedDeals();
    const minSavings = 30;
    const maxSavings = 85;
    const filterCriteria = {
      minSavings,
      maxSavings,
      requiredDrmNames: ["Steam"],
    };

    const filtered = api.filterDeals(deals, filterCriteria);

    const now = Date.now();
    const EXPIRY_WINDOW_MS = 48 * 60 * 60 * 1000;
    for (const d of filtered) {
      if (d.deal.expiry) {
        const expiryTime = Date.parse(d.deal.expiry);
        expect(
          isNaN(expiryTime) || expiryTime - now > EXPIRY_WINDOW_MS,
        ).toBeTruthy();
      }
    }

    expect(filtered.length).toBeGreaterThan(0);

    for (const d of filtered) {
      expect(d.deal.cut).toBeGreaterThanOrEqual(minSavings);
      expect(d.deal.cut).toBeLessThanOrEqual(maxSavings);
      const hasSteam = d.deal.drm?.some((info) => info.name === "Steam");
      expect(hasSteam).toBeTruthy();
    }
  });
});
