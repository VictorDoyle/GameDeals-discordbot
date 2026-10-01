import { api, getCachedDeals } from "./fixtures/itadFixture";

describe("API Connection", () => {
  test("can fetch deals via the fixture (single API call)", async () => {
    const deals = await getCachedDeals();
    expect(Array.isArray(deals)).toBe(true);
    expect(deals.length).toBeGreaterThanOrEqual(0);
  });

  test("ITADApi instance can be constructed", () => {
    expect(api).toBeTruthy();
  });
});
