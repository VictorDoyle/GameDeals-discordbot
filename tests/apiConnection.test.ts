import { api, describeLive, getCachedDeals } from "./fixtures/itadFixture";

describeLive("API Connection", () => {
  jest.setTimeout(30000);

  test("can fetch deals via the fixture (single API call)", async () => {
    const deals = await getCachedDeals();
    expect(Array.isArray(deals)).toBe(true);
    expect(deals.length).toBeGreaterThanOrEqual(0);
  });

  test("ITADApi instance can be constructed", () => {
    expect(api).toBeTruthy();
  });
});
