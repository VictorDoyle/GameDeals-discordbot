import { ITADDeal, ITADConfig } from '../types';
import { EmbedBuilder } from 'discord.js';

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
    params.append('sort', config.sort || '-hot');
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
    maxSavings: number = 85
  ): ITADDeal[] {
    console.log('\n--- FILTER DEBUG (ITADApi) ---');

    const step1 = deals.filter(deal => deal.deal);
    console.log(`After checking deal exists: ${step1.length}`);

    const step2 = step1.filter(deal => deal.type === 'game');
    console.log(`After type === 'game': ${step2.length}`);
    console.log(`Rejected types:`, [...new Set(step1.filter(d => d.type !== 'game').map(d => d.type))]);

    const step3 = step2.filter(deal => {
      const cut = deal.deal.cut || 0;
      return cut >= minSavings && cut <= maxSavings;
    });
    console.log(`After savings filter (${minSavings}-${maxSavings}%): ${step3.length}`);

    // Debug: Show actual cut values from step2
    const cuts = step2.slice(0, 10).map(d => `${d.title}: ${d.deal.cut}%`);
    console.log(`Sample cuts from step2:`, cuts);
    const cutValues = step2.map(d => d.deal.cut || 0);
    const minCut = Math.min(...cutValues);
    const maxCut = Math.max(...cutValues);
    console.log(`Cut range: ${minCut}% to ${maxCut}%`);

    const step4 = step3.filter(deal => {
      return deal.deal.drm?.some(drmInfo => drmInfo.name === 'Steam');
    });
    console.log(`After Steam DRM filter: ${step4.length}`);
    console.log(`Sample DRM arrays:`, step3.slice(0, 3).map(d => `${d.title}: ${JSON.stringify(d.deal.drm)}`));
    console.log('--- END FILTER DEBUG ---\n');

    // Apply core filters (type, savings, Steam DRM) first
    const baseFiltered = deals.filter(deal => {
      if (!deal.deal) return false;

      // Only accept games, not DLC
      if (deal.type !== 'game') return false;

      // max the savings at 85% to avoid junk/shovelware games
      const cut = deal.deal.cut || 0;
      if (cut < minSavings || cut > maxSavings) return false;

      const hasSteamDRM = deal.deal.drm?.some(drmInfo => drmInfo.name === 'Steam');
      if (!hasSteamDRM) return false;

      return true;
    });

    console.log(`After core filters: ${baseFiltered.length}`);

    // exclude deals expiring within the next 48 hours
    const now = Date.now();
    const EXPIRY_WINDOW_MS = 48 * 60 * 60 * 1000;

    const finalFiltered = baseFiltered.filter(deal => {
      const expiry = deal.deal?.expiry;
      if (!expiry) return true;

      const expiryTime = Date.parse(expiry);
      if (isNaN(expiryTime)) return true;

      return (expiryTime - now) > EXPIRY_WINDOW_MS;
    });

    console.log(`After expiry (>48h) filter: ${finalFiltered.length}`);

    return finalFiltered;
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

  formatDealEmbed(deal: ITADDeal): EmbedBuilder {
    const price = deal.deal.price;
    const regular = deal.deal.regular;
    const cut = deal.deal.cut;
    const shop = deal.deal.shop;

    const embed = new EmbedBuilder()
      .setTitle(deal.title)
      .setURL(deal.deal.url)
      .setColor(deal.deal.flag === 'H' ? 0x00ff99 : 0x5865F2)
      .addFields(
        { name: 'Price', value: `${price.currency} ${price.amount.toFixed(2)} (was ${regular.amount.toFixed(2)})`, inline: true },
        { name: 'Discount', value: `${cut}% OFF`, inline: true },
        { name: 'Store', value: shop.name, inline: true }
      );

    if (deal.deal.flag === 'H') {
      embed.setDescription('🔥 **HISTORICAL LOW**');
    }

    const steamReview = deal.reviews?.find(r => r.source === 'Steam');
    if (steamReview) {
      embed.addFields({ name: 'Steam Rating', value: `${steamReview.score}% (${steamReview.count.toLocaleString()} reviews)`, inline: true });
    }

    // Prefer boxart as thumbnail, fall back to banner or game image
    const assets = (deal as any).assets || {};
    const gameImage = (deal as any).game?.image;
    const boxart = assets.boxart;
    const banner600 = assets.banner600 || assets.banner300 || assets.banner;

    if (boxart) {
      embed.setThumbnail(boxart);
    } else if (banner600) {
      embed.setImage(banner600);
    } else if (gameImage) {
      embed.setThumbnail(gameImage);
    }

    return embed;
  }
}