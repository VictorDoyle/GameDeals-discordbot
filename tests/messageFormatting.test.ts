import { getCachedDeals, api } from './fixtures/itadFixture';

describe('Discord message formatting', () => {
  jest.setTimeout(30000);

  test('formatDealMessage contains required elements and is under 2000 chars (uses cached data)', async () => {
    const deals = await getCachedDeals();
    expect(deals.length).toBeGreaterThan(0);

    const deal = deals[0];
    const message = api.formatDealMessage(deal);

    const requiredElements = [deal.title, 'Price:', 'Discount:', 'OFF', 'Store:', 'Link:'];
    for (const el of requiredElements) {
      expect(message.includes(el)).toBeTruthy();
    }

    expect(message.length).toBeLessThanOrEqual(2000);
  });
});
