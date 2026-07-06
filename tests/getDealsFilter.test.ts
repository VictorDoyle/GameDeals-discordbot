import { ITADApi } from "../src/services/ITADApi";

describe("fetchDealsPage cut filter", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("appends cut filter to request URL when savings bounds provided", async () => {
    let capturedUrl = "";

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      capturedUrl = input.toString();
      return {
        ok: true,
        json: async () => ({ list: [] }),
      } as Response;
    });

    const api = new ITADApi("test-api-key");
    await api.fetchDealsPage({
      country: "US",
      limit: 10,
      minSavings: 30,
      maxSavings: 85,
    });

    expect(capturedUrl).toContain("filter=");
    const filterParam = new URL(capturedUrl).searchParams.get("filter");
    expect(filterParam).toBe(JSON.stringify({ cut: { min: 30, max: 85 } }));
  });

  test("omits cut filter when savings bounds not provided", async () => {
    let capturedUrl = "";

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      capturedUrl = input.toString();
      return {
        ok: true,
        json: async () => ({ list: [] }),
      } as Response;
    });

    const api = new ITADApi("test-api-key");
    await api.fetchDealsPage({ country: "US", limit: 10 });

    expect(new URL(capturedUrl).searchParams.get("filter")).toBeNull();
  });

  test("returns nextOffset derived from request offset and list length", async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          list: [{ id: "a" }, { id: "b" }],
        }),
      } as Response;
    });

    const api = new ITADApi("test-api-key");
    const page = await api.fetchDealsPage({ country: "US", offset: 100, limit: 10 });

    expect(page.list).toHaveLength(2);
    expect(page.nextOffset).toBe(102);
  });
});
