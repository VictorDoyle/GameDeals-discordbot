import type { Deal } from "./deal";

function betterShop(a: Deal, b: Deal): number {
  if (a.price !== b.price) {
    return a.price - b.price;
  }
  if (a.cut !== b.cut) {
    return b.cut - a.cut;
  }
  return a.shopName.localeCompare(b.shopName);
}

export function consolidateDeals(deals: Deal[]): Deal[] {
  const groups = new Map<string, Deal[]>();
  const order: string[] = [];

  for (const deal of deals) {
    const group = groups.get(deal.id);
    if (!group) {
      groups.set(deal.id, [deal]);
      order.push(deal.id);
    } else {
      group.push(deal);
    }
  }

  return order.map((id) => {
    const group = groups.get(id) ?? [];
    const [best, ...rest] = group.slice().sort(betterShop);
    if (rest.length === 0) {
      return best;
    }
    return {
      ...best,
      alsoAt: rest.map((deal) => ({
        shopName: deal.shopName,
        price: deal.price,
        currency: deal.currency,
      })),
    };
  });
}
