import { CheapSharkDeal, ApiConfig, GameDetails } from '../types';

export class CheapSharkAPI {
  private baseUrl: string = 'https://www.cheapshark.com/api/1.0';

  buildQueryParams(config: ApiConfig): string {
    const params = new URLSearchParams();

    if (config.sortBy) params.append('sortBy', config.sortBy);
    if (config.desc !== undefined) params.append('desc', config.desc ? '1' : '0');
    if (config.lowerPrice !== undefined) params.append('lowerPrice', config.lowerPrice.toString());
    if (config.upperPrice !== undefined) params.append('upperPrice', config.upperPrice.toString());
    if (config.metacritic !== undefined) params.append('metacritic', config.metacritic.toString());
    if (config.steamRating !== undefined) params.append('steamRating', config.steamRating.toString());
    if (config.onSale !== undefined) params.append('onSale', config.onSale ? '1' : '0');
    if (config.storeID !== undefined) params.append('storeID', config.storeID.toString());
    if (config.pageSize !== undefined) params.append('pageSize', config.pageSize.toString());

    return params.toString();
  }

  async getGameDetails(gameID: string): Promise<GameDetails | null> {
    const url = `${this.baseUrl}/games?id=${gameID}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Failed to fetch game details for ${gameID}: ${response.status}`);
        return null;
      }

      const data = await response.json() as GameDetails;
      return data;
    } catch (error) {
      console.error(`Error fetching game details for ${gameID}:`, error);
      return null;
    }
  }

  async getDeals(config: ApiConfig, minSavings?: number, limit?: number): Promise<CheapSharkDeal[]> {
    const queryString = this.buildQueryParams(config);
    const url = `${this.baseUrl}/deals?${queryString}`;

    console.log(`Fetching deals from: ${url}`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      let deals: CheapSharkDeal[] = await response.json() as CheapSharkDeal[];

      console.log(`Fetched ${deals.length} deals from api`);

      if (config.minReviewCount && config.minReviewCount > 0) {
        deals = deals.filter(deal => {
          const reviewCount = parseInt(deal.steamRatingCount || '0');
          return reviewCount >= config.minReviewCount!;
        });
        console.log(`Filtered to ${deals.length} deals with ${config.minReviewCount}+ reviews`);
      }

      if (minSavings && minSavings > 0) {
        deals = deals.filter(deal => parseFloat(deal.savings) >= minSavings);
        console.log(`Filtered to ${deals.length} deals with ${minSavings}%+ savings`);
      }

      if (limit && deals.length > limit) {
        deals = deals.slice(0, limit);
        console.log(`Limited to ${limit} deals`);
      }

      return deals;
    } catch (error) {
      console.error('Error fetching deals from api:', error);
      throw error;
    }
  }

  async getDealsWithGameDetails(config: ApiConfig, minSavings?: number, limit?: number): Promise<CheapSharkDeal[]> {
    const deals = await this.getDeals(config, minSavings, limit);
    const enhancedDeals: CheapSharkDeal[] = [];

    for (const deal of deals) {
      const gameDetails = await this.getGameDetails(deal.gameID);

      if (gameDetails && gameDetails.deals) {
        const allDeals = gameDetails.deals;
        const cheaperStores = allDeals
          .filter(d => parseFloat(d.price) < parseFloat(deal.salePrice))
          .map(d => d.storeID);

        const dealWithExtras: any = {
          ...deal,
          cheaperStores: cheaperStores
        };

        enhancedDeals.push(dealWithExtras);
      } else {
        enhancedDeals.push(deal);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return enhancedDeals;
  }

  async getDealsFromMultipleStores(
    config: ApiConfig,
    storeIDs: number[],
    dealsPerStore: number,
    minSavings?: number,
    fetchGameDetails: boolean = false
  ): Promise<CheapSharkDeal[]> {
    const allDeals: CheapSharkDeal[] = [];

    for (const storeID of storeIDs) {
      console.log(`Fetching ${dealsPerStore} deals from store ${storeID}...`);
      const storeConfig = { ...config, storeID };

      let deals: CheapSharkDeal[];
      if (fetchGameDetails) {
        deals = await this.getDealsWithGameDetails(storeConfig, minSavings, dealsPerStore);
      } else {
        deals = await this.getDeals(storeConfig, minSavings, dealsPerStore);
      }

      console.log(`Got ${deals.length} deals from store ${storeID}`);
      allDeals.push(...deals);

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Total deals from all stores: ${allDeals.length}`);
    return allDeals;
  }

  formatDealMessage(deal: CheapSharkDeal, stores: Map<string, string>): string {
    const savings = parseFloat(deal.savings).toFixed(0);
    const salePrice = parseFloat(deal.salePrice).toFixed(2);
    const normalPrice = parseFloat(deal.normalPrice).toFixed(2);

    let message = `**${deal.title}**\n\n`;
    message += `Price: $${salePrice} (was $${normalPrice})\n`;
    message += `Discount: ${savings}% OFF\n`;

    if (deal.steamRatingPercent && parseInt(deal.steamRatingPercent) > 0) {
      message += `Steam Rating: ${deal.steamRatingPercent}%`;
      if (deal.steamRatingText) {
        message += ` (${deal.steamRatingText})`;
      }
      message += `\n`;
    }

    if (deal.metacriticScore && parseInt(deal.metacriticScore) > 0) {
      message += `Metacritic: ${deal.metacriticScore}/100\n`;
    }

    const cheaperStores = (deal as any).cheaperStores;
    if (cheaperStores && cheaperStores.length > 0) {
      const storeNames = cheaperStores
        .map((id: string) => stores.get(id) || `Store ${id}`)
        .join(', ');
      message += `Cheaper at: ${storeNames}\n`;
    }

    message += `Link: https://www.cheapshark.com/redirect?dealID=${deal.dealID}\n\n`;

    return message;
  }

  async getStores(): Promise<Map<string, string>> {
    const url = `${this.baseUrl}/stores`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch stores: ${response.status}`);
      }

      const stores = await response.json() as Array<{ storeID: string; storeName: string }>;
      const storeMap = new Map<string, string>();

      stores.forEach(store => {
        storeMap.set(store.storeID, store.storeName);
      });

      return storeMap;
    } catch (error) {
      console.error('Error fetching stores:', error);
      return new Map();
    }
  }

  getStoreIDFromName(storeName: string): number | undefined {
    const storeMap: Record<string, number> = {
      'steam': 1,
      'gamersgate': 2,
      'greenmangaming': 3,
      'gmg': 3,
      'amazon': 4,
      'gamestop': 5,
      'direct2drive': 6,
      'gog': 7,
      'origin': 8,
      'humble': 11,
      'humblestore': 11,
      'uplay': 13,
      'fanatical': 15,
      'wingamestore': 21,
      'gamesplanet': 23,
      'voidu': 24,
      'epicgames': 25,
      'epic': 25
    };

    return storeMap[storeName.toLowerCase()];
  }
}