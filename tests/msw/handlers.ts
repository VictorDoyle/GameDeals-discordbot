import { http, HttpResponse } from "msw";
import deals from "../fixtures/itad/deals-v2.json";
import gameInfoById from "../fixtures/itad/games-info-v2.json";

const infoMap = gameInfoById as Record<string, unknown>;

export const handlers = [
  http.get("https://api.isthereanydeal.com/deals/v2", () => {
    return HttpResponse.json(deals);
  }),
  http.get("https://api.isthereanydeal.com/games/info/v2", ({ request }) => {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const info = infoMap[id];
    if (!info) {
      return HttpResponse.json({ id, reviews: [] });
    }
    return HttpResponse.json(info);
  }),
];
