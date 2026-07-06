import { ITADDeal } from "../types";
import { DealPredicate } from "./dealFilters";

export interface DealCollectorStats {
  accepted: number;
  skippedPosted: number;
  skippedFilter: number;
  skippedDuplicate: number;
}

export class DealCollector {
  private readonly targetCount: number;
  private readonly postedIds: ReadonlySet<string>;
  private readonly matchesDeal: DealPredicate;
  private readonly collectedIds = new Set<string>();
  private readonly collected: ITADDeal[] = [];
  private readonly statsInternal: DealCollectorStats = {
    accepted: 0,
    skippedPosted: 0,
    skippedFilter: 0,
    skippedDuplicate: 0,
  };

  constructor(
    targetCount: number,
    postedIds: ReadonlySet<string>,
    matchesDeal: DealPredicate,
  ) {
    this.targetCount = targetCount;
    this.postedIds = postedIds;
    this.matchesDeal = matchesDeal;
  }

  accept(deal: ITADDeal): boolean {
    if (this.collected.length >= this.targetCount) {
      return false;
    }

    if (!this.matchesDeal(deal)) {
      this.statsInternal.skippedFilter++;
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

  get results(): ITADDeal[] {
    return this.collected;
  }

  get needsMore(): boolean {
    return this.collected.length < this.targetCount;
  }

  get stats(): DealCollectorStats {
    return { ...this.statsInternal };
  }
}
