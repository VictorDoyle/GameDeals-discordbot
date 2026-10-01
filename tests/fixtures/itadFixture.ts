import dotenv from "dotenv";
dotenv.config();

import { ITADApi } from "../../src/services/ITADApi";
import type { ITADDeal } from "../../src/types";

const apiKey = process.env.ITAD_API_KEY;
const live = process.env.ITAD_LIVE === "1";

if (live && !apiKey) {
  throw new Error("ITAD_API_KEY is required for live tests (ITAD_LIVE=1)");
}

const shopIds: number[] = process.env.SHOP_IDS
  ? process.env.SHOP_IDS.split(",").map((s) => parseInt(s.trim(), 10))
  : [61, 35, 6, 3];

export const api = new ITADApi(apiKey ?? "test-fixture-key");

let cachedDeals: ITADDeal[] | null = null;

export async function getCachedDeals(): Promise<ITADDeal[]> {
  if (cachedDeals) return cachedDeals;
  cachedDeals = await api.getDeals({
    country: "US",
    limit: 50,
    shops: shopIds,
    minSavings: 30,
    maxSavings: 85,
  });
  return cachedDeals;
}
