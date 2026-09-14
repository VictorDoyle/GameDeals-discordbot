import { http, HttpResponse } from "msw";
import { ITADApi } from "../src/services/ITADApi";
import { server } from "./msw/server";

describe("fetchDealsPage cut filter", () => {
  test("appends cut filter to request URL when savings bounds provided", async () => {
    let capturedUrl = "";

    server.use(
      http.get("https://api.isthereanydeal.com/deals/v2", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ list: [] });
      }),
    );

    const api = new ITADApi("test-api-key");
    await api.fetchDealsPage({
      country: "US",
      limit: 10,
      minSavings: 30,
      maxSavings: 85,
    });

    expect(capturedUrl).toContain("filter=");
    const parsed = new URL(capturedUrl);
    expect(parsed.searchParams.get("filter")).toBe(
      JSON.stringify({ cut: { min: 30, max: 85 } }),
    );
    expect(parsed.searchParams.get("key")).toBeNull();
  });

  test("omits cut filter when savings bounds not provided", async () => {
    let capturedUrl = "";

    server.use(
      http.get("https://api.isthereanydeal.com/deals/v2", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ list: [] });
      }),
    );

    const api = new ITADApi("test-api-key");
    await api.fetchDealsPage({ country: "US", limit: 10 });

    expect(new URL(capturedUrl).searchParams.get("filter")).toBeNull();
  });

  test("returns nextOffset derived from request offset and list length", async () => {
    server.use(
      http.get("https://api.isthereanydeal.com/deals/v2", () => {
        return HttpResponse.json({
          list: [{ id: "a" }, { id: "b" }],
        });
      }),
    );

    const api = new ITADApi("test-api-key");
    const page = await api.fetchDealsPage({
      country: "US",
      offset: 100,
      limit: 10,
    });

    expect(page.list).toHaveLength(2);
    expect(page.nextOffset).toBe(102);
  });
});
