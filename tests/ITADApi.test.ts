import { http, HttpResponse } from "msw";
import type { Deal } from "../src/core/deal";
import { ITADApi } from "../src/services/ITADApi";
import { server } from "./msw/server";

function stubDeal(id: string): Deal {
  return {
    id,
    title: id,
    type: "game",
    hasOffer: true,
    url: "https://example.com",
    shopId: 61,
    shopName: "Steam",
    price: 1,
    regular: 2,
    currency: "USD",
    cut: 50,
    drmNames: ["Steam"],
    expiry: null,
    historicalLow: false,
  };
}

describe("ITADApi request", () => {
  test("sends ITAD-API-Key header and omits key from the query string", async () => {
    let capturedUrl = "";
    let capturedKey: string | null = null;

    server.use(
      http.get("https://api.isthereanydeal.com/deals/v2", ({ request }) => {
        capturedUrl = request.url;
        capturedKey = request.headers.get("ITAD-API-Key");
        return HttpResponse.json({ list: [] });
      }),
    );

    const api = new ITADApi("secret-key");
    await api.fetchDealsPage({ country: "US", limit: 10 });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get("key")).toBeNull();
    expect(capturedUrl).not.toContain("secret-key");
    expect(capturedKey).toBe("secret-key");
  });

  test("retries 429 using Retry-After then succeeds", async () => {
    let calls = 0;
    server.use(
      http.get("https://api.isthereanydeal.com/deals/v2", () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { status_code: 429, reason_phrase: "Too Many Requests" },
            { status: 429, headers: { "Retry-After": "0" } },
          );
        }
        return HttpResponse.json({ list: [{ id: "a" }] });
      }),
    );

    const api = new ITADApi("secret-key");
    const page = await api.fetchDealsPage({ country: "US", limit: 10 });

    expect(calls).toBe(2);
    expect(page.list).toEqual([{ id: "a" }]);
  });

  test("retries 5xx then succeeds", async () => {
    let calls = 0;
    server.use(
      http.get("https://api.isthereanydeal.com/deals/v2", () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { status_code: 503, reason_phrase: "Unavailable" },
            { status: 503, headers: { "Retry-After": "0" } },
          );
        }
        return HttpResponse.json({ list: [] });
      }),
    );

    const api = new ITADApi("secret-key");
    await api.fetchDealsPage({ country: "US", limit: 10 });

    expect(calls).toBe(2);
  });

  test("does not retry 400", async () => {
    let calls = 0;
    server.use(
      http.get("https://api.isthereanydeal.com/deals/v2", () => {
        calls += 1;
        return HttpResponse.json(
          { status_code: 400, reason_phrase: "Bad Request" },
          { status: 400 },
        );
      }),
    );

    const api = new ITADApi("secret-key");
    await expect(
      api.fetchDealsPage({ country: "US", limit: 10 }),
    ).rejects.toThrow("ITAD API request failed: 400 Bad Request");
    expect(calls).toBe(1);
  });

  test("does not retry invalid JSON", async () => {
    let calls = 0;
    server.use(
      http.get("https://api.isthereanydeal.com/deals/v2", () => {
        calls += 1;
        return new HttpResponse("not json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const api = new ITADApi("secret-key");
    await expect(
      api.fetchDealsPage({ country: "US", limit: 10 }),
    ).rejects.toThrow("ITAD API returned invalid JSON");
    expect(calls).toBe(1);
  });
});

describe("enrichDeals", () => {
  test("attaches reviews to every collected deal", async () => {
    const api = new ITADApi("secret-key");
    const getInfo = vi.spyOn(api, "getGameInfo").mockResolvedValue(
      new Map([
        [
          "good",
          {
            reviews: [{ source: "Steam", score: 90, count: 10_000 }],
          } as never,
        ],
        [
          "bad",
          {
            reviews: [{ source: "Steam", score: 10, count: 10_000 }],
          } as never,
        ],
      ]),
    );

    const enriched = await api.enrichDeals([
      stubDeal("good"),
      stubDeal("bad"),
      stubDeal("over"),
    ]);

    expect(enriched.map((deal) => deal.id)).toEqual(["good", "bad", "over"]);
    expect(enriched[0].reviews?.[0].score).toBe(90);
    expect(enriched[2].reviews).toBeUndefined();
    expect(getInfo).toHaveBeenCalledWith(["good", "bad", "over"]);
  });
});
