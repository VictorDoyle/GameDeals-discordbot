import { ITADApi } from "../src/services/ITADApi";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function header(init: RequestInit | undefined, name: string): string | null {
  const headers = init?.headers;
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) {
    const found = headers.find(
      ([key]) => key.toLowerCase() === name.toLowerCase(),
    );
    return found?.[1] ?? null;
  }
  const record = headers as Record<string, string>;
  return record[name] ?? record[name.toLowerCase()] ?? null;
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) =>
        headers[name] ?? headers[name.toLowerCase()] ?? null,
    },
    json: async () => body,
  } as Response;
}

describe("ITADApi request", () => {
  test("sends ITAD-API-Key header and omits key from the query string", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = input.toString();
        capturedInit = init;
        return jsonResponse(200, { list: [] });
      },
    );

    const api = new ITADApi("secret-key");
    await api.fetchDealsPage({ country: "US", limit: 10 });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get("key")).toBeNull();
    expect(capturedUrl).not.toContain("secret-key");
    expect(header(capturedInit, "ITAD-API-Key")).toBe("secret-key");
  });

  test("retries 429 using Retry-After then succeeds", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          429,
          { status_code: 429, reason_phrase: "Too Many Requests" },
          { "Retry-After": "0" },
        ),
      )
      .mockResolvedValueOnce(jsonResponse(200, { list: [{ id: "a" }] }));
    global.fetch = fetchMock;

    const api = new ITADApi("secret-key");
    const page = await api.fetchDealsPage({ country: "US", limit: 10 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(page.list).toEqual([{ id: "a" }]);
  });

  test("retries 5xx then succeeds", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          503,
          { status_code: 503, reason_phrase: "Unavailable" },
          {
            "Retry-After": "0",
          },
        ),
      )
      .mockResolvedValueOnce(jsonResponse(200, { list: [] }));
    global.fetch = fetchMock;

    const api = new ITADApi("secret-key");
    await api.fetchDealsPage({ country: "US", limit: 10 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("does not retry 400", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(400, { status_code: 400, reason_phrase: "Bad Request" }),
      );
    global.fetch = fetchMock;

    const api = new ITADApi("secret-key");
    await expect(
      api.fetchDealsPage({ country: "US", limit: 10 }),
    ).rejects.toThrow("ITAD API request failed: 400 Bad Request");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("does not retry invalid JSON", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => {
        throw new Error("boom");
      },
    } as unknown as Response);
    global.fetch = fetchMock;

    const api = new ITADApi("secret-key");
    await expect(
      api.fetchDealsPage({ country: "US", limit: 10 }),
    ).rejects.toThrow("ITAD API returned invalid JSON");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
