export interface ITADPrice {
  amount: number;
  amountInt: number;
  currency: string;
}

export interface ITADShop {
  id: number;
  name: string;
}

export interface ITADDRM {
  id: number;
  name: string;
}

export interface ITADPlatform {
  id: number;
  name: string;
}

export interface ITADDealInfo {
  shop: ITADShop;
  price: ITADPrice;
  regular: ITADPrice;
  cut: number;
  voucher: any;
  storeLow: ITADPrice;
  historyLow: ITADPrice;
  historyLow_1y?: ITADPrice;
  historyLow_3m?: ITADPrice;
  flag: string | null;
  drm: ITADDRM[];
  platforms: ITADPlatform[];
  timestamp: string;
  expiry: string | null;
  url: string;
}

export interface ITADReview {
  score: number;
  source: string;
  count: number;
  url?: string;
}

export interface ITADAssets {
  boxart?: string;
  banner145?: string;
  banner300?: string;
  banner400?: string;
  banner600?: string;
}

export interface ITADDeal {
  id: string;
  slug: string;
  title: string;
  type: string | null;
  mature: boolean;
  assets: ITADAssets;
  deal: ITADDealInfo;
  reviews?: ITADReview[];
}

export interface ITADConfig {
  country?: string;
  offset?: number;
  limit?: number;
  sort?: '-cut' | 'price' | '-price' | '-hot' | 'title' | '-reviews';
  shops?: number[];
}

export interface ITADGameInfo {
  id: string;
  slug: string;
  title: string;
  type: string;
  mature: boolean;
  earlyAccess: boolean;
  achievements: boolean;
  tradingCards: boolean;
  appid?: number;
  tags?: string[];
  releaseDate?: string;
  reviews?: ITADReview[];
}

export interface DealHistory {
  postedDeals: Record<string, number>;
  lastRotation: number;
}