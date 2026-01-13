import dotenv from 'dotenv';
dotenv.config();

import { getCachedDeals } from './fixtures/itadFixture';

describe('Store filtering', () => {
  jest.setTimeout(30000);

  test('deals come from requested stores only (uses cached data)', async () => {
    const shopIds = process.env.SHOP_IDS
      ? process.env.SHOP_IDS.split(',').map(id => parseInt(id.trim(), 10))
      : [61, 35, 6];

    const deals = await getCachedDeals();
    expect(deals.length).toBeGreaterThan(0);

    const storeIds = new Set(deals.map(d => d.deal.shop.id));
    for (const sid of Array.from(storeIds)) {
      expect(shopIds).toContain(sid);
    }
  });
});
