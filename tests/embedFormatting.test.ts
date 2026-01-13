import { getCachedDeals, api } from './fixtures/itadFixture';
import type { ITADDeal } from '../src/types';

describe('Embed formatting', () => {
  jest.setTimeout(30000);

  test('formatDealEmbed returns embed with expected structure and images (uses cached data)', async () => {
    const deals = await getCachedDeals();
    expect(deals.length).toBeGreaterThan(0);

    let candidate: ITADDeal | null = null;
    for (const d of deals) {
      const assets = (d as any).assets || {};
      const gameImage = (d as any).game?.image;
      if (assets.boxart || assets.banner600 || gameImage) {
        candidate = d;
        break;
      }
    }

    const deal = candidate || deals[0];
    const embed = api.formatDealEmbed(deal as ITADDeal);
    const json = (embed as any).toJSON ? (embed as any).toJSON() : embed;

    expect(json.title).toBe(deal.title);
    expect(json.url).toBe(deal.deal.url);

    const fieldNames = (json.fields || []).map((f: any) => f.name);
    const required = ['Price', 'Discount', 'Store'];
    for (const r of required) expect(fieldNames).toContain(r);

    if (deal.deal.flag === 'H') {
      const desc = json.description || '';
      expect(String(desc).toLowerCase()).toContain('historical low');
    }

    // Image checks (best-effort, depending on available assets)
    const assets = (deal as any).assets || {};
    const gameImage = (deal as any).game?.image;
    const boxart = assets.boxart;
    const banner600 = assets.banner600 || assets.banner300 || assets.banner;

    const hasThumbnail = !!json.thumbnail?.url;
    const hasImage = !!json.image?.url;

    if (boxart) {
      expect(hasThumbnail && String(json.thumbnail?.url || '').includes(boxart)).toBeTruthy();
    } else if (banner600) {
      expect(hasImage && String(json.image?.url || '').includes(banner600)).toBeTruthy();
    } else if (gameImage) {
      expect(hasThumbnail && String(json.thumbnail?.url || '').includes(gameImage)).toBeTruthy();
    }
  });
});
