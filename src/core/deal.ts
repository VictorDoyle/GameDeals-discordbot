import type { ITADDeal } from "../types";

export interface DealReview {
  source: string;
  score: number;
  count: number;
}

export interface AlsoAt {
  shopName: string;
  price: number;
  currency: string;
}

export type DealBadge = "historical-low" | "near-low" | "store-low";

export interface Deal {
  id: string;
  title: string;
  type: string | null;
  hasOffer: boolean;
  url: string;
  shopId: number;
  shopName: string;
  price: number;
  regular: number;
  currency: string;
  cut: number;
  drmNames: string[];
  expiry: string | null;
  historicalLow: boolean;
  historyLow?: number;
  storeLow?: number;
  alsoAt?: AlsoAt[];
  reviews?: DealReview[];
  thumbnail?: string;
  image?: string;
}

export type GiveawayRaw = {
  id: string;
  title?: string;
  type?: string | null;
  shop?: { id: number; name: string };
  url?: string;
  expiry?: string | null;
};

export function mapItadDeal(raw: ITADDeal): Deal {
  const offer = raw.deal;
  if (!offer) {
    return {
      id: raw.id,
      title: raw.title,
      type: raw.type,
      hasOffer: false,
      url: "",
      shopId: 0,
      shopName: "",
      price: 0,
      regular: 0,
      currency: "",
      cut: 0,
      drmNames: [],
      expiry: null,
      historicalLow: false,
      reviews: raw.reviews,
    };
  }

  const assets = raw.assets ?? {};
  const thumbnail = assets.boxart;
  const image = thumbnail ? undefined : (assets.banner600 ?? assets.banner300);

  return {
    id: raw.id,
    title: raw.title,
    type: raw.type,
    hasOffer: true,
    url: offer.url,
    shopId: offer.shop.id,
    shopName: offer.shop.name,
    price: offer.price.amount,
    regular: offer.regular.amount,
    currency: offer.price.currency,
    cut: offer.cut ?? 0,
    drmNames: (offer.drm ?? []).map((drm) => drm.name),
    expiry: offer.expiry ?? null,
    historicalLow: offer.flag === "H",
    historyLow: offer.historyLow?.amount,
    storeLow: offer.storeLow?.amount,
    reviews: raw.reviews,
    thumbnail,
    image,
  };
}

export function mapGiveaway(raw: GiveawayRaw): Deal {
  return {
    id: raw.id,
    title: raw.title ?? raw.id,
    type: raw.type ?? "game",
    hasOffer: true,
    url: raw.url ?? "",
    shopId: raw.shop?.id ?? 0,
    shopName: raw.shop?.name ?? "",
    price: 0,
    regular: 0,
    currency: "USD",
    cut: 100,
    drmNames: [],
    expiry: raw.expiry ?? null,
    historicalLow: false,
  };
}

export function dealBadges(deal: Deal, nearLowPercent = 5): DealBadge[] {
  const badges: DealBadge[] = [];
  if (deal.historicalLow) {
    badges.push("historical-low");
  } else if (
    nearLowPercent > 0 &&
    deal.historyLow != null &&
    deal.historyLow > 0 &&
    deal.price <= deal.historyLow * (1 + nearLowPercent / 100)
  ) {
    badges.push("near-low");
  }
  if (deal.storeLow != null && deal.price <= deal.storeLow + 1e-6) {
    badges.push("store-low");
  }
  return badges;
}

export function isFreeDeal(deal: Deal): boolean {
  return deal.price === 0 || deal.cut >= 100;
}
