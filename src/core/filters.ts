import { isFreeDeal, type Deal } from "./deal";

export interface DealFilterCriteria {
  minSavings: number;
  maxSavings: number;
  allowedTypes?: ReadonlySet<string | null>;
  requiredDrmNames?: readonly string[];
  minHoursUntilExpiry?: number;
  minRating?: number;
  minReviewCount?: number;
  includeFree?: boolean;
  minPrice?: number | null;
  maxPrice?: number | null;
}

export type RejectReason =
  | "missing-deal"
  | "type"
  | "cut"
  | "drm"
  | "expiry"
  | "rating"
  | "reviews"
  | "price";

export type DealReject = (deal: Deal) => RejectReason | null;

const DEFAULT_ALLOWED_TYPES: ReadonlySet<string | null> = new Set(["game"]);
const DEFAULT_MIN_HOURS_UNTIL_EXPIRY = 48;

export function hasDealInfo(deal: Deal): boolean {
  return deal.hasOffer;
}

export function isAllowedType(
  deal: Deal,
  allowedTypes: ReadonlySet<string | null>,
): boolean {
  return allowedTypes.has(deal.type);
}

export function savingsInRange(
  deal: Deal,
  minSavings: number,
  maxSavings: number,
): boolean {
  return deal.cut >= minSavings && deal.cut <= maxSavings;
}

export function hasAnyDrmName(
  deal: Deal,
  drmNames: readonly string[],
): boolean {
  if (drmNames.length === 0) {
    return true;
  }

  return drmNames.some((name) => deal.drmNames.includes(name));
}

export function expiresAfterWindow(
  deal: Deal,
  minHoursUntilExpiry: number,
): boolean {
  if (!deal.expiry) {
    return true;
  }

  const expiryTime = Date.parse(deal.expiry);
  if (isNaN(expiryTime)) {
    return true;
  }

  const minExpiryMs = minHoursUntilExpiry * 60 * 60 * 1000;
  return expiryTime - Date.now() > minExpiryMs;
}

function steamReview(deal: Deal) {
  return deal.reviews?.find((review) => review.source === "Steam");
}

export function meetsMinRating(deal: Deal, minRating: number): boolean {
  if (minRating <= 0) {
    return true;
  }

  const review = steamReview(deal);
  return review !== undefined && review.score >= minRating;
}

export function meetsMinReviewCount(
  deal: Deal,
  minReviewCount: number,
): boolean {
  if (minReviewCount <= 0) {
    return true;
  }

  const review = steamReview(deal);
  return review !== undefined && review.count >= minReviewCount;
}

export function rejectDeal(
  deal: Deal,
  criteria: DealFilterCriteria,
): RejectReason | null {
  const allowedTypes = criteria.allowedTypes ?? DEFAULT_ALLOWED_TYPES;
  const requiredDrmNames = criteria.requiredDrmNames ?? [];
  const minHoursUntilExpiry =
    criteria.minHoursUntilExpiry ?? DEFAULT_MIN_HOURS_UNTIL_EXPIRY;
  const minRating = criteria.minRating ?? 0;
  const minReviewCount = criteria.minReviewCount ?? 0;

  if (!hasDealInfo(deal)) {
    return "missing-deal";
  }
  if (!isAllowedType(deal, allowedTypes)) {
    return "type";
  }
  const includeFree = criteria.includeFree === true && isFreeDeal(deal);
  if (
    !includeFree &&
    !savingsInRange(deal, criteria.minSavings, criteria.maxSavings)
  ) {
    return "cut";
  }
  if (criteria.minPrice != null && deal.price < criteria.minPrice) {
    return "price";
  }
  if (criteria.maxPrice != null && deal.price > criteria.maxPrice) {
    return "price";
  }
  if (!hasAnyDrmName(deal, requiredDrmNames)) {
    return "drm";
  }
  if (!expiresAfterWindow(deal, minHoursUntilExpiry)) {
    return "expiry";
  }
  if (!meetsMinRating(deal, minRating)) {
    return "rating";
  }
  if (!meetsMinReviewCount(deal, minReviewCount)) {
    return "reviews";
  }
  return null;
}

export function createDealMatcher(
  criteria: DealFilterCriteria,
): (deal: Deal) => boolean {
  return (deal) => rejectDeal(deal, criteria) === null;
}

export function filterDeals(
  deals: Deal[],
  criteria: DealFilterCriteria,
): Deal[] {
  return deals.filter((deal) => rejectDeal(deal, criteria) === null);
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
