export interface CheapSharkDeal {
  internalName: string;
  title: string;
  metacriticLink: string | null;
  dealID: string;
  storeID: string;
  gameID: string;
  salePrice: string;
  normalPrice: string;
  isOnSale: string;
  savings: string;
  metacriticScore: string;
  steamRatingText: string | null;
  steamRatingPercent: string;
  steamRatingCount: string;
  steamAppID: string | null;
  releaseDate: number;
  lastChange: number;
  dealRating: string;
  thumb: string;
  cheaperStores?: string[];
}

export interface ApiConfig {
  sortBy?: 'Deal Rating' | 'Title' | 'Savings' | 'Price' | 'Metacritic' | 'Reviews' | 'Release' | 'Store' | 'recent';
  desc?: boolean;
  lowerPrice?: number;
  upperPrice?: number;
  metacritic?: number;
  steamRating?: number;
  onSale?: boolean;
  storeID?: number;
  pageSize?: number;
  minReviewCount?: number;
  minDealRating?: number;
}

export interface GameDeal {
  storeID: string;
  dealID: string;
  price: string;
  retailPrice: string;
  savings: string;
}

export interface GameInfo {
  title: string;
  steamAppID: string | null;
  thumb: string;
}

export interface CheapestPriceEver {
  price: string;
  date: number;
}

export interface GameDetails {
  info: GameInfo;
  cheapestPriceEver: CheapestPriceEver;
  deals: GameDeal[];
}

export interface DealHistory {
  postedDeals: Record<string, number>;
  lastRotation: number;
}