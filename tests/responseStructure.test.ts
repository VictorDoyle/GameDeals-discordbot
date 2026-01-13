import { getCachedDeals } from './fixtures/itadFixture';
import type { ITADDeal } from '../src/types';

describe('Response structure', () => {
  jest.setTimeout(30000);

  test('cached deals contain required fields', async () => {
    const deals = await getCachedDeals();
    expect(Array.isArray(deals)).toBe(true);
    expect(deals.length).toBeGreaterThan(0);

    const deal = deals[0] as ITADDeal;
    const required: Array<keyof ITADDeal> = ['id', 'slug', 'title', 'type', 'mature', 'assets', 'deal'];

    for (const field of required) {
      expect(deal).toHaveProperty(field);
    }

    if (deal.deal) {
      const dealFields = ['shop', 'price', 'regular', 'cut', 'drm', 'platforms', 'timestamp', 'url'];
      for (const f of dealFields) {
        expect(deal.deal).toHaveProperty(f);
      }
    }
  });
});
