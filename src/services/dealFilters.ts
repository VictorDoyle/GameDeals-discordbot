import { ITADDeal } from "../types";

export interface DealFilterCriteria {
  minSavings: number;
  maxSavings: number;
  allowedTypes?: ReadonlySet<string | null>;
  requiredDrmNames?: readonly string[];
  minHoursUntilExpiry?: number;
  minRating?: number;
  minReviewCount?: number;
}

export type DealPredicate = (deal: ITADDeal) => boolean;

const DEFAULT_ALLOWED_TYPES: ReadonlySet<string | null> = new Set(["game"]);
const DEFAULT_MIN_HOURS_UNTIL_EXPIRY = 48;

export function hasDealInfo(deal: ITADDeal): boolean {
  return Boolean(deal.deal);
}

export function isAllowedType(
  deal: ITADDeal,
  allowedTypes: ReadonlySet<string | null>,
): boolean {
  return allowedTypes.has(deal.type);
}

export function savingsInRange(
  deal: ITADDeal,
  minSavings: number,
  maxSavings: number,
): boolean {
  const cut = deal.deal?.cut ?? 0;
  return cut >= minSavings && cut <= maxSavings;
}

export function hasAnyDrmName(
  deal: ITADDeal,
  drmNames: readonly string[],
): boolean {
  if (drmNames.length === 0) {
    return true;
  }

  return (
    deal.deal?.drm?.some((drmInfo) => drmNames.includes(drmInfo.name)) ?? false
  );
}

export function expiresAfterWindow(
  deal: ITADDeal,
  minHoursUntilExpiry: number,
): boolean {
  const expiry = deal.deal?.expiry;
  if (!expiry) {
    return true;
  }

  const expiryTime = Date.parse(expiry);
  if (isNaN(expiryTime)) {
    return true;
  }

  const minExpiryMs = minHoursUntilExpiry * 60 * 60 * 1000;
  return expiryTime - Date.now() > minExpiryMs;
}

function steamReview(deal: ITADDeal) {
  return deal.reviews?.find((review) => review.source === "Steam");
}

export function meetsMinRating(deal: ITADDeal, minRating: number): boolean {
  if (minRating <= 0) {
    return true;
  }

  const review = steamReview(deal);
  return review !== undefined && review.score >= minRating;
}

export function meetsMinReviewCount(
  deal: ITADDeal,
  minReviewCount: number,
): boolean {
  if (minReviewCount <= 0) {
    return true;
  }

  const review = steamReview(deal);
  return review !== undefined && review.count >= minReviewCount;
}

export function createDealMatcher(criteria: DealFilterCriteria): DealPredicate {
  const allowedTypes = criteria.allowedTypes ?? DEFAULT_ALLOWED_TYPES;
  const requiredDrmNames = criteria.requiredDrmNames ?? [];
  const minHoursUntilExpiry =
    criteria.minHoursUntilExpiry ?? DEFAULT_MIN_HOURS_UNTIL_EXPIRY;
  const minRating = criteria.minRating ?? 0;
  const minReviewCount = criteria.minReviewCount ?? 0;

  return (deal: ITADDeal): boolean => {
    if (!hasDealInfo(deal)) {
      return false;
    }

    if (!isAllowedType(deal, allowedTypes)) {
      return false;
    }

    if (!savingsInRange(deal, criteria.minSavings, criteria.maxSavings)) {
      return false;
    }

    if (!hasAnyDrmName(deal, requiredDrmNames)) {
      return false;
    }

    if (!expiresAfterWindow(deal, minHoursUntilExpiry)) {
      return false;
    }

    if (!meetsMinRating(deal, minRating)) {
      return false;
    }

    if (!meetsMinReviewCount(deal, minReviewCount)) {
      return false;
    }

    return true;
  };
}

export function parseDrmNamesFromEnv(rawValue: string | undefined): string[] {
  if (!rawValue || rawValue.trim().length === 0) {
    return [];
  }

  return rawValue
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}
