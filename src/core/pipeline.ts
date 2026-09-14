import type { BotConfig } from "../config/schema";
import { postDealBatches } from "../posting";
import { DealCollector } from "../services/dealCollector";
import type { ITADApi } from "../services/ITADApi";
import type { JsonStateStore } from "../state/jsonStore";
import { consolidateDeals } from "./consolidate";
import { mapGiveaway, mapItadDeal, type Deal } from "./deal";
import { rejectDeal, type RejectReason } from "./filters";

const PAGE_SIZE = 200;
const PAGE_GAP_MS = 200;

export type RunReport = {
  scanned: number;
  accepted: number;
  skippedPosted: number;
  skippedFilter: number;
  skippedDuplicate: number;
  rejects: Partial<Record<RejectReason, number>>;
  posted: Deal[];
};

function addReject(
  rejects: Partial<Record<RejectReason, number>>,
  reason: RejectReason,
): void {
  rejects[reason] = (rejects[reason] ?? 0) + 1;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatRunReport(report: RunReport): string {
  const rejectParts = Object.entries(report.rejects)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([reason, count]) => `${reason}=${count}`);

  return [
    `scanned: ${report.scanned}`,
    `accepted: ${report.accepted}`,
    `posted: ${report.posted.length}`,
    `skipped posted: ${report.skippedPosted}`,
    `skipped filters: ${report.skippedFilter}`,
    `skipped duplicate: ${report.skippedDuplicate}`,
    `rejects: ${rejectParts.length > 0 ? rejectParts.join(" ") : "none"}`,
  ].join("\n");
}

function collectCriteria(config: BotConfig) {
  const giveaways = config.source === "giveaways";
  return {
    minSavings: config.filters.minDiscount,
    maxSavings: config.filters.maxDiscount,
    requiredDrmNames: giveaways ? [] : config.filters.drmNames,
    minHoursUntilExpiry: config.filters.minHoursUntilExpiry,
    includeFree: config.filters.includeFree || giveaways,
    minPrice: config.filters.minPrice,
    maxPrice: config.filters.maxPrice,
  };
}

export async function runPipeline(opts: {
  api: ITADApi;
  store: JsonStateStore;
  config: BotConfig;
  sendEmbeds?: (batch: Deal[]) => Promise<void>;
}): Promise<RunReport> {
  const { api, store, config } = opts;
  const criteria = collectCriteria(config);
  const ratingFiltersOn =
    config.source !== "giveaways" &&
    (config.filters.minRating > 0 || config.filters.minReviews > 0);

  const collector = new DealCollector(config.limit, store.postedIds(), (deal) =>
    rejectDeal(deal, criteria),
  );

  let scanned = 0;

  if (config.source === "giveaways") {
    const raw = await api.fetchGiveaways(config.country);
    scanned = raw.length;
    for (const item of raw) {
      collector.accept(mapGiveaway(item));
      if (!collector.needsMore) {
        break;
      }
    }
  } else {
    let offset = 0;
    let pageNumber = 0;

    while (collector.needsMore) {
      if (pageNumber > 0) {
        await sleep(PAGE_GAP_MS);
      }

      const page = await api.fetchDealsPage({
        country: config.country,
        sort: "-cut",
        shops: config.shopIds,
        minSavings: config.filters.minDiscount,
        maxSavings: config.filters.maxDiscount,
        limit: PAGE_SIZE,
        offset,
      });
      pageNumber++;
      scanned += page.list.length;

      if (page.list.length === 0) {
        break;
      }

      for (const raw of page.list) {
        collector.accept(mapItadDeal(raw));
        if (!collector.needsMore) {
          break;
        }
      }

      if (page.list.length < PAGE_SIZE) {
        break;
      }

      offset = page.nextOffset;
    }
  }

  const collectStats = collector.stats;
  const rejects = { ...collectStats.rejects };
  let deals = consolidateDeals(collector.results);
  const uniqueAccepted = deals.length;

  if (ratingFiltersOn) {
    const enriched = await api.enrichDeals(deals);
    const kept: Deal[] = [];
    for (const deal of enriched) {
      const reason = rejectDeal(deal, {
        ...criteria,
        minRating: config.filters.minRating,
        minReviewCount: config.filters.minReviews,
      });
      if (reason) {
        addReject(rejects, reason);
        continue;
      }
      kept.push(deal);
    }
    deals = kept;
  }

  if (opts.sendEmbeds && deals.length > 0) {
    await postDealBatches(deals, opts.sendEmbeds, (batch) => {
      store.markPosted(batch);
    });
  }

  return {
    scanned,
    accepted: uniqueAccepted,
    skippedPosted: collectStats.skippedPosted,
    skippedFilter:
      collectStats.skippedFilter + (uniqueAccepted - deals.length),
    skippedDuplicate: collectStats.skippedDuplicate,
    rejects,
    posted: deals,
  };
}
