import { EmbedBuilder } from "discord.js";
import type { Deal } from "../core/deal";
import {
  ITADConfig,
  ITADDeal,
  ITADDealsResponse,
  ITADGameInfo,
} from "../types";

const REQUEST_TIMEOUT_MS = 15_000; // ITAD can stall
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 500; // jittered exponential backoff
const INFO_CALL_GAP_MS = 200; // ITAD 1000 req / 5 min

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isRetryableNetworkError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TypeError")
  );
}

function delayFor(response: Response | undefined, attempt: number): number {
  const raw = response?.headers.get("Retry-After");
  if (raw != null) {
    const seconds = Number.parseInt(raw, 10);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
  }

  const exp = BASE_DELAY_MS * 2 ** (attempt - 1);
  return Math.round(exp * (0.5 + Math.random() / 2));
}

async function itadErrorMessage(response: Response): Promise<string> {
  let errorMessage = `ITAD API request failed: ${response.status}`;
  try {
    const errorBody = (await response.json()) as {
      status_code?: number;
      reason_phrase?: string;
    };
    if (errorBody.status_code !== undefined && errorBody.reason_phrase) {
      errorMessage = `ITAD API request failed: ${errorBody.status_code} ${errorBody.reason_phrase}`;
    }
  } catch {
    // keep the status-only message
  }
  return errorMessage;
}

export class ITADApi {
  private baseUrl: string = "https://api.isthereanydeal.com";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async requestJson(url: string): Promise<unknown> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        let response: Response;
        try {
          response = await fetch(url, {
            headers: { "ITAD-API-Key": this.apiKey },
            signal: controller.signal,
          });
        } catch (error) {
          lastError = error;
          if (attempt < MAX_ATTEMPTS && isRetryableNetworkError(error)) {
            await sleep(delayFor(undefined, attempt));
            continue;
          }
          throw error;
        }

        if (!response.ok) {
          lastError = new Error(await itadErrorMessage(response));
          if (isRetryableStatus(response.status) && attempt < MAX_ATTEMPTS) {
            await sleep(delayFor(response, attempt));
            continue;
          }
          throw lastError;
        }

        try {
          return await response.json();
        } catch {
          throw new Error("ITAD API returned invalid JSON");
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError;
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

    const url = `${this.baseUrl}/deals/v2?${params.toString()}`;
    const data = (await this.requestJson(url)) as { list?: ITADDeal[] };
    const list = data.list || [];

    return {
      list,
      nextOffset: requestOffset + list.length,
    };
  }

  async getDeals(config: ITADConfig): Promise<ITADDeal[]> {
    const page = await this.fetchDealsPage(config);
    return page.list;
  }

  async getShops(): Promise<Map<number, string>> {
    const url = `${this.baseUrl}/service/shops/v1`;

    try {
      const shops = (await this.requestJson(url)) as Array<{
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

  async getGameInfo(gameIds: string[]): Promise<Map<string, ITADGameInfo>> {
    const gameInfoMap = new Map<string, ITADGameInfo>();

    for (const gameId of gameIds) {
      try {
        const url = `${this.baseUrl}/games/info/v2?id=${encodeURIComponent(gameId)}`;
        const info = (await this.requestJson(url)) as ITADGameInfo;
        gameInfoMap.set(gameId, info);

        await sleep(INFO_CALL_GAP_MS);
      } catch (error) {
        console.error(`Error fetching info for game ${gameId}:`, error);
      }
    }

    return gameInfoMap;
  }

  async enrichDeals(deals: Deal[]): Promise<Deal[]> {
    const infoMap = await this.getGameInfo(deals.map((deal) => deal.id));

    return deals.map((deal) => {
      const info = infoMap.get(deal.id);
      if (!info?.reviews?.length) {
        return { ...deal };
      }
      return { ...deal, reviews: info.reviews };
    });
  }

  formatDealMessage(deal: Deal): string {
    let message = `**${deal.title}**\n\n`;
    message += `Price: ${deal.currency} ${deal.price.toFixed(2)} (was ${deal.regular.toFixed(2)})\n`;
    message += `Discount: ${deal.cut}% OFF\n`;

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

    message += `Store: ${deal.shopName}\n`;

    if (deal.historicalLow) {
      message += `HISTORICAL LOW!\n`;
    }

    message += `Link: ${deal.url}\n\n`;

    return message;
  }

  formatDealEmbed(deal: Deal): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(deal.title)
      .setURL(deal.url)
      .setColor(deal.historicalLow ? 0x00ff99 : 0x5865f2)
      .addFields(
        {
          name: "Price",
          value: `${deal.currency} ${deal.price.toFixed(2)} (was ${deal.regular.toFixed(2)})`,
          inline: true,
        },
        { name: "Discount", value: `${deal.cut}% OFF`, inline: true },
        { name: "Store", value: deal.shopName, inline: true },
      );

    if (deal.historicalLow) {
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

    if (deal.thumbnail) {
      embed.setThumbnail(deal.thumbnail);
    } else if (deal.image) {
      embed.setImage(deal.image);
    }

    return embed;
  }
}
