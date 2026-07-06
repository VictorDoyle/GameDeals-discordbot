import { EmbedBuilder } from "discord.js";
import { ITADConfig, ITADDeal, ITADDealsResponse } from "../types";
import {
  createDealMatcher,
  DealFilterCriteria,
  hasAnyDrmName,
  savingsInRange,
} from "./dealFilters";

export type {
  DealFilterCriteria,
  DealPredicate,
} from "./dealFilters";
export {
  createDealMatcher,
  expiresAfterWindow,
  hasAnyDrmName,
  hasDealInfo,
  isAllowedType,
  parseDrmNamesFromEnv,
  savingsInRange,
} from "./dealFilters";

export class ITADApi {
  private baseUrl: string = "https://api.isthereanydeal.com";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchDealsPage(config: ITADConfig): Promise<ITADDealsResponse> {
    const requestOffset = config.offset || 0;
    const params = new URLSearchParams();

    params.append("country", config.country || "US");
    params.append("offset", requestOffset.toString());
    params.append("limit", (config.limit || 100).toString());
    params.append("sort", config.sort || "-cut");
    params.append("nondeals", "false");
    params.append("mature", "false");

    if (config.shops && config.shops.length > 0) {
      params.append("shops", config.shops.join(","));
    }

    if (config.minSavings !== undefined || config.maxSavings !== undefined) {
      const cutFilter = {
        cut: {
          min: config.minSavings ?? 0,
          max: config.maxSavings ?? null,
        },
      };
      params.append("filter", JSON.stringify(cutFilter));
    }

    const url = `${this.baseUrl}/deals/v2?key=${this.apiKey}&${params.toString()}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        let errorMessage = `ITAD API request failed: ${response.status}`;
        try {
          const errorBody = (await response.json()) as {
            status_code?: number;
            reason_phrase?: string;
          };
          if (errorBody.status_code !== undefined && errorBody.reason_phrase) {
            errorMessage = `ITAD API request failed: ${errorBody.status_code} ${errorBody.reason_phrase}`;
          }
        } catch (error) {
          console.debug("Response was not expected JSON format", error);
        }
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as {
        list?: ITADDeal[];
      };
      const list = data.list || [];

      return {
        list,
        nextOffset: requestOffset + list.length,
      };
    } catch (error) {
      console.error("Error fetching deals from ITAD:", error);
      throw error;
    }
  }

  async getDeals(config: ITADConfig): Promise<ITADDeal[]> {
    const page = await this.fetchDealsPage(config);
    return page.list;
  }

  async getShops(): Promise<Map<number, string>> {
    const url = `${this.baseUrl}/service/shops/v1`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch shops: ${response.status}`);
      }

      const shops = (await response.json()) as Array<{
        id: number;
        title: string;
      }>;
      const shopMap = new Map<number, string>();

      shops.forEach((shop) => {
        shopMap.set(shop.id, shop.title);
      });

      return shopMap;
    } catch (error) {
      console.error("Error fetching shops:", error);
      return new Map();
    }
  }

  filterDeals(
    deals: ITADDeal[],
    criteria: DealFilterCriteria,
  ): ITADDeal[] {
    const minSavings = criteria.minSavings;
    const maxSavings = criteria.maxSavings;
    const requiredDrmNames = criteria.requiredDrmNames ?? [];
    const drmLabel =
      requiredDrmNames.length > 0 ? requiredDrmNames.join(", ") : "none";

    console.log("\n--- FILTER DEBUG (ITADApi) ---");

    const step1 = deals.filter((deal) => deal.deal);
    console.log(`After checking deal exists: ${step1.length}`);

    const step2 = step1.filter((deal) => deal.type === "game");
    console.log(`After type === 'game': ${step2.length}`);
    console.log(`Rejected types:`, [
      ...new Set(step1.filter((d) => d.type !== "game").map((d) => d.type)),
    ]);

    const step3 = step2.filter((deal) => {
      return savingsInRange(deal, minSavings, maxSavings);
    });
    console.log(
      `After savings filter (${minSavings}-${maxSavings}%): ${step3.length}`,
    );

    const cuts = step2.slice(0, 10).map((d) => `${d.title}: ${d.deal.cut}%`);
    console.log(`Sample cuts from step2:`, cuts);
    const cutValues = step2.map((d) => d.deal.cut || 0);
    const minCut = Math.min(...cutValues);
    const maxCut = Math.max(...cutValues);
    console.log(`Cut range: ${minCut}% to ${maxCut}%`);

    const step4 = step3.filter((deal) => {
      return hasAnyDrmName(deal, requiredDrmNames);
    });
    console.log(`After DRM filter (${drmLabel}): ${step4.length}`);
    console.log(
      `Sample DRM arrays:`,
      step3.slice(0, 3).map((d) => `${d.title}: ${JSON.stringify(d.deal.drm)}`),
    );
    console.log("--- END FILTER DEBUG ---\n");

    const matchesDeal = createDealMatcher(criteria);
    const finalFiltered = deals.filter(matchesDeal);

    console.log(`After all filters: ${finalFiltered.length}`);

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

        await new Promise((resolve) => setTimeout(resolve, 200));
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

    const steamReview = deal.reviews?.find(
      (review) => review.source === "Steam",
    );
    if (steamReview) {
      message += `Steam Rating: ${steamReview.score}% (${steamReview.count.toLocaleString()} reviews)\n`;
    }

    const metacritic = deal.reviews?.find(
      (review) => review.source === "Metascore",
    );
    if (metacritic) {
      message += `Metacritic: ${metacritic.score}/100\n`;
    }

    const shop = deal.deal.shop;
    message += `Store: ${shop.name}\n`;

    if (deal.deal.flag === "H") {
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
      .setColor(deal.deal.flag === "H" ? 0x00ff99 : 0x5865f2)
      .addFields(
        {
          name: "Price",
          value: `${price.currency} ${price.amount.toFixed(2)} (was ${regular.amount.toFixed(2)})`,
          inline: true,
        },
        { name: "Discount", value: `${cut}% OFF`, inline: true },
        { name: "Store", value: shop.name, inline: true },
      );

    if (deal.deal.flag === "H") {
      embed.setDescription("🔥 **HISTORICAL LOW**");
    }

    const steamReview = deal.reviews?.find((r) => r.source === "Steam");
    if (steamReview) {
      embed.addFields({
        name: "Steam Rating",
        value: `${steamReview.score}% (${steamReview.count.toLocaleString()} reviews)`,
        inline: true,
      });
    }

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
