import type { ITADDeal } from "../types";

export interface DealReview {
  source: string;
  score: number;
  count: number;
}

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
  reviews?: DealReview[];
  thumbnail?: string;
  image?: string;
}

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
    reviews: raw.reviews,
    thumbnail,
    image,
  };
}
