import dotenv from 'dotenv';
dotenv.config();

import { ITADApi } from '../../src/services/ITADApi';
import type { ITADDeal } from '../../src/types';

const apiKey = process.env.ITAD_API_KEY;
if (!apiKey) {
  throw new Error('ITAD_API_KEY is required for these tests');
}

const shopIds: number[] = process.env.SHOP_IDS
  ? process.env.SHOP_IDS.split(',').map(s => parseInt(s.trim(), 10))
  : [61, 35, 37, 24, 29, 36, 49];

export const api = new ITADApi(apiKey);

let cachedDeals: ITADDeal[] | null = null;

export async function getCachedDeals(): Promise<ITADDeal[]> {
  if (cachedDeals) return cachedDeals;
  // single live API call for the whole test run
  cachedDeals = await api.getDeals({ country: 'US', limit: 50, shops: shopIds });
  return cachedDeals;
}
