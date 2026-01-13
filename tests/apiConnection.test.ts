import dotenv from 'dotenv';
dotenv.config();

import { api, getCachedDeals } from './fixtures/itadFixture';

const itIf = process.env.ITAD_API_KEY ? test : test.skip;

describe('API Connection', () => {
  jest.setTimeout(30000);

  itIf('can fetch deals via the fixture (single API call)', async () => {
    const deals = await getCachedDeals();
    expect(Array.isArray(deals)).toBe(true);
    expect(deals.length).toBeGreaterThanOrEqual(0);
  });

  test('ITADApi instance can be constructed', () => {
    expect(api).toBeTruthy();
  });
});
