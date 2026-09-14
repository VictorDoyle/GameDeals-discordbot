import type { BotConfig } from "../config/schema";
import { postDealBatches } from "../posting";
import { DealCollector } from "../services/dealCollector";
import type { ITADApi } from "../services/ITADApi";
import type { JsonStateStore } from "../state/jsonStore";
import { mapItadDeal, type Deal } from "./deal";
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

export async function runPipeline(opts: {
  api: ITADApi;
  store: JsonStateStore;
  config: BotConfig;
  sendEmbeds?: (batch: Deal[]) => Promise<void>;
}): Promise<RunReport> {
  const { api, store, config } = opts;
  const collectCriteria = {
    minSavings: config.filters.minDiscount,
    maxSavings: config.filters.maxDiscount,
    requiredDrmNames: config.filters.drmNames,
    minHoursUntilExpiry: config.filters.minHoursUntilExpiry,
  };
  const ratingFiltersOn =
    config.filters.minRating > 0 || config.filters.minReviews > 0;

  const collector = new DealCollector(config.limit, store.postedIds(), (deal) =>
    rejectDeal(deal, collectCriteria),
  );

  let offset = 0;
  let pageNumber = 0;
  let scanned = 0;

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

  const collectStats = collector.stats;
  const rejects = { ...collectStats.rejects };
  let deals = collector.results;

  if (ratingFiltersOn) {
    const enriched = await api.enrichDeals(deals);
    const kept: Deal[] = [];
    for (const deal of enriched) {
      const reason = rejectDeal(deal, {
        ...collectCriteria,
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
    accepted: collectStats.accepted,
    skippedPosted: collectStats.skippedPosted,
    skippedFilter:
      collectStats.skippedFilter + (collectStats.accepted - deals.length),
    skippedDuplicate: collectStats.skippedDuplicate,
    rejects,
    posted: deals,
  };
}
