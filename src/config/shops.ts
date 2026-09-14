export const SHOP_IDS_BY_NAME: Record<string, number> = {
  allyouplay: 2,
  blizzard: 4,
  fanatical: 6,
  dlgamer: 13,
  dreamgame: 15,
  epic: 16,
  epicgames: 16,
  epicgamestore: 16,
  fireflower: 17,
  gamebillet: 20,
  gamersgate: 24,
  gamesload: 25,
  gamesplanetuk: 26,
  gamesplanetde: 27,
  gamesplanetfr: 28,
  gamesplanetus: 29,
  gog: 35,
  greenmangaming: 36,
  gmg: 36,
  humble: 37,
  humblestore: 37,
  indiegala: 42,
  indiegalastore: 42,
  macgamestore: 47,
  microsoft: 48,
  microsoftstore: 48,
  newegg: 49,
  nuuvem: 50,
  ea: 52,
  eastore: 52,
  steam: 61,
  ubisoft: 62,
  ubisoftstore: 62,
  wingamestore: 64,
  joybuggy: 65,
  playsum: 70,
  zoomplatform: 72,
  planetplay: 73,
  playerland: 74,
  fortunadigital: 75,
  muve: 77,
  zapagames: 78,
};

export function resolveShopId(store: string | number): number {
  if (typeof store === "number") {
    if (!Number.isInteger(store) || store <= 0) {
      throw new Error(
        `stores must be a shop name or positive id, got ${store}`,
      );
    }
    return store;
  }

  const trimmed = store.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const key = trimmed.toLowerCase().replace(/[\s_-]+/g, "");
  const id = SHOP_IDS_BY_NAME[key];
  if (id === undefined) {
    throw new Error(`stores: unknown shop ${JSON.stringify(store)}`);
  }
  return id;
}
