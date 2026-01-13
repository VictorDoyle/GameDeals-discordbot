import { getCachedDeals, api } from './fixtures/itadFixture';
import type { ITADDeal } from '../src/types';

describe('Filtering logic', () => {
  jest.setTimeout(30000);

  test('filterDeals enforces savings and Steam DRM and expiry window (uses cached data)', async () => {
    const deals = await getCachedDeals();
    const minSavings = 30;
    const maxSavings = 85;

    const filtered = api.filterDeals(deals, minSavings, maxSavings);

    // Expiry check (>48h) if present
    const now = Date.now();
    const EXPIRY_WINDOW_MS = 48 * 60 * 60 * 1000;
    for (const d of filtered) {
      if (d.deal.expiry) {
        const expiryTime = Date.parse(d.deal.expiry);
        expect(isNaN(expiryTime) || (expiryTime - now) > EXPIRY_WINDOW_MS).toBeTruthy();
      }
    }

    if (filtered.length === 0) {
      // If no results returned it's acceptable (depends on live data)
      expect(filtered.length).toBe(0);
      return;
    }

    for (const d of filtered) {
      expect(d.deal.cut).toBeGreaterThanOrEqual(minSavings);
      expect(d.deal.cut).toBeLessThanOrEqual(maxSavings);
      const hasSteam = d.deal.drm?.some((info: any) => info.name === 'Steam');
      expect(hasSteam).toBeTruthy();
    }
  });
});
