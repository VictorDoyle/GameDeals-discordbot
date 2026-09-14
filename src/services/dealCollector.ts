import type { Deal } from "../core/deal";
import type { DealReject, RejectReason } from "../core/filters";

export interface DealCollectorStats {
  accepted: number;
  skippedPosted: number;
  skippedFilter: number;
  skippedDuplicate: number;
  rejects: Partial<Record<RejectReason, number>>;
}

export class DealCollector {
  private readonly targetCount: number;
  private readonly postedIds: ReadonlySet<string>;
  private readonly reject: DealReject;
  private readonly collectedIds = new Set<string>();
  private readonly collected: Deal[] = [];
  private readonly statsInternal: DealCollectorStats = {
    accepted: 0,
    skippedPosted: 0,
    skippedFilter: 0,
    skippedDuplicate: 0,
    rejects: {},
  };

  constructor(
    targetCount: number,
    postedIds: ReadonlySet<string>,
    reject: DealReject,
  ) {
    this.targetCount = targetCount;
    this.postedIds = postedIds;
    this.reject = reject;
  }

  accept(deal: Deal): boolean {
    if (this.collected.length >= this.targetCount) {
      return false;
    }

    const reason = this.reject(deal);
    if (reason) {
      this.statsInternal.skippedFilter++;
      this.statsInternal.rejects[reason] =
        (this.statsInternal.rejects[reason] ?? 0) + 1;
      return false;
    }

    if (this.postedIds.has(deal.id)) {
      this.statsInternal.skippedPosted++;
      return false;
    }

    if (this.collectedIds.has(deal.id)) {
      this.statsInternal.skippedDuplicate++;
      return false;
    }

    this.collected.push(deal);
    this.collectedIds.add(deal.id);
    this.statsInternal.accepted++;
    return true;
  }

  get results(): Deal[] {
    return this.collected;
  }

  get needsMore(): boolean {
    return this.collected.length < this.targetCount;
  }

  get stats(): DealCollectorStats {
    return {
      ...this.statsInternal,
      rejects: { ...this.statsInternal.rejects },
    };
  }
}
