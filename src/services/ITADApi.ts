import { ITADDeal, ITADConfig } from '../types';

export class ITADApi {
  private baseUrl: string = 'https://api.isthereanydeal.com';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json'
    };
  }

  async getDeals(config: ITADConfig): Promise<ITADDeal[]> {
    const params = new URLSearchParams();

    params.append('country', config.country || 'US');
    params.append('offset', (config.offset || 0).toString());
    params.append('limit', (config.limit || 100).toString());
    params.append('sort', config.sort || '-cut');
    params.append('nondeals', 'false');
    params.append('mature', 'false');

    if (config.shops && config.shops.length > 0) {
      params.append('shops', config.shops.join(','));
    }

    const url = `${this.baseUrl}/deals/v2?key=${this.apiKey}&${params.toString()}`;

    console.log(`Fetching deals from ITAD...`);

    try {
      const response = await fetch(url, {
        headers: this.buildHeaders()
      });

      if (!response.ok) {
        throw new Error(`ITAD API request failed: ${response.status}`);
      }

      const data = await response.json() as { list?: ITADDeal[]; hasMore?: boolean; nextOffset?: number };
      return data.list || [];
    } catch (error) {
      console.error('Error fetching deals from ITAD:', error);
      throw error;
    }
  }

  async getShops(): Promise<Map<number, string>> {
    const url = `${this.baseUrl}/service/shops/v1`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch shops: ${response.status}`);
      }

      const shops = await response.json() as Array<{ id: number; title: string }>;
      const shopMap = new Map<number, string>();

      shops.forEach(shop => {
        shopMap.set(shop.id, shop.title);
      });

      return shopMap;
    } catch (error) {
      console.error('Error fetching shops:', error);
      return new Map();
    }
  }

  filterDeals(
    deals: ITADDeal[],
    minSavings: number = 30,
    minReviewCount: number = 100,
    minRating?: number
  ): ITADDeal[] {
    return deals.filter(deal => {
      if (!deal.deal) return false;

      const cut = deal.deal.cut || 0;
      if (cut < minSavings) return false;

      const hasSteamReview = deal.reviews?.some(review => review.source === 'Steam');
      if (!hasSteamReview) return false;

      const steamReview = deal.reviews?.find(review => review.source === 'Steam');
      if (!steamReview) return false;

      if ((steamReview.count || 0) < minReviewCount) return false;

      if (minRating !== undefined) {
        if ((steamReview.score || 0) < minRating) return false;
      }

      const hasSteamDRM = deal.deal.drm?.some(drmInfo => drmInfo.name === 'Steam');
      if (!hasSteamDRM) return false;

      return true;
    });
  }

  async getGameInfo(gameIds: string[]): Promise<Map<string, any>> {
    const gameInfoMap = new Map<string, any>();

    for (const gameId of gameIds.slice(0, 10)) {
      try {
        const url = `${this.baseUrl}/games/info/v2?key=${this.apiKey}&id=${gameId}`;
        const response = await fetch(url);

        if (response.ok) {
          const info = await response.json();
          gameInfoMap.set(gameId, info);
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error fetching info for game ${gameId}:`, error);
      }
    }

    return gameInfoMap;
  }

  formatDealMessage(deal: ITADDeal): string {
    const price = deal.deal.price;
    const regular = deal.deal.regular;
    const cut = deal.deal.cut;

    let message = `**${deal.title}**\n\n`;
    message += `Price: ${price.currency} ${price.amount.toFixed(2)} (was ${regular.amount.toFixed(2)})\n`;
    message += `Discount: ${cut}% OFF\n`;

    const steamReview = deal.reviews?.find(review => review.source === 'Steam');
    if (steamReview) {
      message += `Steam Rating: ${steamReview.score}% (${steamReview.count.toLocaleString()} reviews)\n`;
    }

    const metacritic = deal.reviews?.find(review => review.source === 'Metascore');
    if (metacritic) {
      message += `Metacritic: ${metacritic.score}/100\n`;
    }

    const shop = deal.deal.shop;
    message += `Store: ${shop.name}\n`;

    if (deal.deal.flag === 'H') {
      message += `HISTORICAL LOW!\n`;
    }

    message += `Link: ${deal.deal.url}\n\n`;

    return message;
  }
}