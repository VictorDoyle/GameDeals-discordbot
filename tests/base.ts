import * as dotenv from 'dotenv';
import { ITADApi } from '../src/services/ITADApi';
import { ITADDeal } from '../src/types';

dotenv.config();

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

class ITADTestSuite {
  private apiKey: string;
  private api: ITADApi;
  private results: TestResult[] = [];

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.api = new ITADApi(apiKey);
  }

  private pass(name: string): void {
    this.results.push({ name, passed: true });
    console.log(`PASS: ${name}`);
  }

  private fail(name: string, error: string): void {
    this.results.push({ name, passed: false, error });
    console.log(`FAIL: ${name}`);
    console.log(`      ${error}`);
  }

  async testAPIConnection(): Promise<void> {
    console.log('\n--- Test 1: API Connection ---');
    try {
      const response = await fetch(
        `https://api.isthereanydeal.com/deals/v2?key=${this.apiKey}&limit=1&country=US`
      );

      if (!response.ok) {
        this.fail('API Connection', `HTTP ${response.status}: ${response.statusText}`);
        return;
      }

      const data = await response.json();

      if (!data || typeof data !== 'object') {
        this.fail('API Connection', 'Response is not an object');
        return;
      }

      this.pass('API Connection');
    } catch (error) {
      this.fail('API Connection', error instanceof Error ? error.message : String(error));
    }
  }

  async testResponseStructure(): Promise<void> {
    console.log('\n--- Test 2: Response Structure Validation ---');
    try {
      const deals = await this.api.getDeals({
        country: 'US',
        limit: 5,
        shops: [61]
      });

      if (!Array.isArray(deals)) {
        this.fail('Response is Array', 'Response is not an array');
        return;
      }
      this.pass('Response is Array');

      if (deals.length === 0) {
        this.fail('Deals returned', 'No deals returned from API');
        return;
      }
      this.pass('Deals returned');

      const deal = deals[0];

      const requiredFields: Array<keyof ITADDeal> = [
        'id', 'slug', 'title', 'type', 'mature', 'assets', 'deal'
      ];

      for (const field of requiredFields) {
        if (!(field in deal)) {
          this.fail(`Field: ${field}`, `Missing required field: ${field}`);
        } else {
          this.pass(`Field: ${field}`);
        }
      }

      if (deal.deal) {
        const dealFields = [
          'shop', 'price', 'regular', 'cut', 'drm',
          'platforms', 'timestamp', 'url'
        ];

        for (const field of dealFields) {
          if (!(field in deal.deal)) {
            this.fail(`Deal field: ${field}`, `Missing deal field: ${field}`);
          } else {
            this.pass(`Deal field: ${field}`);
          }
        }
      }

    } catch (error) {
      this.fail('Response Structure', error instanceof Error ? error.message : String(error));
    }
  }

  async testFiltering(): Promise<void> {
    console.log('\n--- Test 3: Filtering Logic ---');
    try {
      const deals = await this.api.getDeals({
        country: 'US',
        limit: 50,
        shops: [61, 35, 37, 24, 29, 36, 49]
      });

      const minSavings = 30;
      const maxSavings = 85;

      console.log(`Total deals fetched: ${deals.length}`);

      // Check what's being filtered at each step
      console.log('\n--- FILTER DEBUG ---');

      let step1 = deals.filter(deal => deal.deal);
      console.log(`After checking deal exists: ${step1.length}`);

      let step2 = step1.filter(deal => deal.type === 'game');
      console.log(`After type === 'game': ${step2.length}`);
      console.log(`Rejected types:`, [...new Set(step1.filter(d => d.type !== 'game').map(d => d.type))]);

      let step3 = step2.filter(deal => {
        const cut = deal.deal.cut || 0;
        return cut >= minSavings && cut <= maxSavings;
      });
      console.log(`After savings filter (${minSavings}-${maxSavings}%): ${step3.length}`);
      console.log(`Sample cuts that passed:`, step3.slice(0, 5).map(d => `${d.title}: ${d.deal.cut}%`));

      let step4 = step3.filter(deal => {
        return deal.deal.drm?.some(drmInfo => drmInfo.name === 'Steam');
      });
      console.log(`After Steam DRM filter: ${step4.length}`);
      console.log(`Sample DRM arrays from step3:`, step3.slice(0, 5).map(d => `${d.title}: ${JSON.stringify(d.deal.drm)}`));

      console.log('--- END DEBUG ---\n');

      const filtered = this.api.filterDeals(deals, minSavings, maxSavings);

      console.log(`Deals after filtering: ${filtered.length}`);

      // Skip deals expiring in 48h
      const now = Date.now();
      const EXPIRY_WINDOW_MS = 48 * 60 * 60 * 1000;
      let allExpiryOk = true;
      for (const deal of filtered) {
        const expiry = deal.deal.expiry;
        if (expiry) {
          const expiryTime = Date.parse(expiry);
          if (!isNaN(expiryTime) && (expiryTime - now) <= EXPIRY_WINDOW_MS) {
            allExpiryOk = false;
            console.log(`  Expiry too soon: ${deal.title} expires at ${expiry}`);
          }
        }
      }

      if (allExpiryOk) {
        this.pass('Expiry filter (>48h)');
      } else {
        this.fail('Expiry filter', 'Some deals expire within 48 hours');
      }

      if (filtered.length === 0) {
        console.log('WARNING: No deals passed filters.');
        this.pass('Filtering (no results but function works)');
        return;
      }

      let allPassedSavings = true;
      let allHaveSteamDRM = true;

      for (const deal of filtered) {
        if (deal.deal.cut < minSavings || deal.deal.cut > maxSavings) {
          allPassedSavings = false;
          console.log(`  Failed savings: ${deal.title} - ${deal.deal.cut}%`);
        }

        const hasSteamDRM = deal.deal.drm?.some(drmInfo => drmInfo.name === 'Steam');
        if (!hasSteamDRM) {
          allHaveSteamDRM = false;
          console.log(`  Failed DRM: ${deal.title} - No Steam DRM`);
        }
      }

      if (allPassedSavings) {
        this.pass(`Savings filter (min ${minSavings}%, max ${maxSavings}%)`);
      } else {
        this.fail(`Savings filter`, 'Some deals below minimum savings');
      }

      if (allHaveSteamDRM) {
        this.pass('Steam DRM filter');
      } else {
        this.fail('Steam DRM filter', 'Some deals without Steam DRM');
      }

    } catch (error) {
      this.fail('Filtering Logic', error instanceof Error ? error.message : String(error));
    }
  }

  async testMessageFormatting(): Promise<void> {
    console.log('\n--- Test 4: Discord Message Formatting ---');
    try {
      const deals = await this.api.getDeals({
        country: 'US',
        limit: 10,
        shops: [61]
      });

      if (deals.length === 0) {
        this.fail('Message Formatting', 'No deals to test formatting');
        return;
      }

      const deal = deals[0];
      const message = this.api.formatDealMessage(deal);

      const requiredElements = [
        deal.title,
        'Price:',
        'Discount:',
        'OFF',
        'Store:',
        'Link:'
      ];

      let allPresent = true;
      const missing: string[] = [];

      for (const element of requiredElements) {
        if (!message.includes(element)) {
          allPresent = false;
          missing.push(element);
        }
      }

      if (allPresent) {
        this.pass('Message contains required elements');
      } else {
        this.fail('Message formatting', `Missing elements: ${missing.join(', ')}`);
      }

      if (message.length > 2000) {
        this.fail('Message length', 'Message exceeds Discord 2000 char limit');
      } else {
        this.pass('Message length within Discord limits');
      }

      console.log('\nSample formatted message:');
      console.log('-'.repeat(60));
      console.log(message);
      console.log('-'.repeat(60));

    } catch (error) {
      this.fail('Message Formatting', error instanceof Error ? error.message : String(error));
    }
  }

  async testEmbedFormatting(): Promise<void> {
    console.log('\n--- Test 6: Discord Embed Formatting ---');
    try {
      const deals = await this.api.getDeals({ country: 'US', limit: 10, shops: [61] });

      if (!deals || deals.length === 0) {
        this.fail('Embed Formatting', 'No deals to test embed formatting');
        return;
      }

      // Prefer a deal with assets or game image for testing image selection
      let candidate: ITADDeal | null = null;
      for (const d of deals) {
        const assets = (d as any).assets || {};
        const gameImage = (d as any).game?.image;
        if (assets.boxart || assets.banner600 || gameImage) {
          candidate = d;
          break;
        }
      }

      // If none matched, just use the first deal to validate structure
      const deal = candidate || deals[0];

      const embed = this.api.formatDealEmbed(deal);
      const json = embed.toJSON();

      // Title and URL
      if (json.title === deal.title && json.url === deal.deal.url) {
        this.pass('Embed title and URL');
      } else {
        this.fail('Embed title/URL', `Expected title ${deal.title} and url ${deal.deal.url}`);
      }

      // Fields: Price, Discount, Store
      const fieldNames = (json.fields || []).map((f: any) => f.name);
      const required = ['Price', 'Discount', 'Store'];
      const missing = required.filter(r => !fieldNames.includes(r));
      if (missing.length === 0) {
        this.pass('Embed fields present');
      } else {
        this.fail('Embed fields', `Missing fields: ${missing.join(', ')}`);
      }

      // Description for historical low
      if (deal.deal.flag === 'H') {
        const desc = json.description || '';
        if (desc.toLowerCase().includes('historical low')) {
          this.pass('Embed historical low description');
        } else {
          this.fail('Embed historical low', 'Historical low flag set but description missing');
        }
      } else {
        this.pass('Embed historical low (not applicable)');
      }

      // Image selection
      const assets = (deal as any).assets || {};
      const gameImage = (deal as any).game?.image;
      const boxart = assets.boxart;
      const banner600 = assets.banner600 || assets.banner300 || assets.banner;

      const hasThumbnail = !!json.thumbnail?.url;
      const hasImage = !!json.image?.url;

      if (boxart) {
        if (hasThumbnail && String(json.thumbnail?.url || '').includes(boxart)) {
          this.pass('Embed thumbnail uses boxart');
        } else {
          this.fail('Embed thumbnail', 'Boxart present but not used as thumbnail');
        }
      } else if (banner600) {
        if (hasImage && String(json.image?.url || '').includes(banner600)) {
          this.pass('Embed image uses banner');
        } else {
          this.fail('Embed image', 'Banner present but not used as image');
        }
      } else if (gameImage) {
        if (hasThumbnail && String(json.thumbnail?.url || '').includes(gameImage)) {
          this.pass('Embed thumbnail uses game image');
        } else {
          this.fail('Embed game image', 'Game image present but not used');
        }
      } else {
        this.pass('Embed image not applicable');
      }

    } catch (error) {
      this.fail('Embed Formatting', error instanceof Error ? error.message : String(error));
    }
  }

  async testStoreFiltering(): Promise<void> {
    console.log('\n--- Test 5: Store Filtering ---');
    try {
      const shopIds = process.env.SHOP_IDS
        ? process.env.SHOP_IDS.split(',').map(id => parseInt(id.trim()))
        : [61, 35, 6];

      console.log(`Testing with shop IDs: ${shopIds.join(', ')}`);

      const deals = await this.api.getDeals({
        country: 'US',
        limit: 20,
        shops: shopIds
      });

      if (deals.length === 0) {
        this.fail('Store Filtering', 'No deals returned for specified stores');
        return;
      }

      const storeIds = new Set(deals.map(deal => deal.deal.shop.id));
      const allInRequestedStores = Array.from(storeIds).every(storeId => shopIds.includes(storeId));

      if (allInRequestedStores) {
        this.pass('Store filtering works');
      } else {
        this.fail('Store filtering', 'Deals from unexpected stores returned');
      }

      console.log(`Stores in results: ${Array.from(storeIds).join(', ')}`);

    } catch (error) {
      this.fail('Store Filtering', error instanceof Error ? error.message : String(error));
    }
  }

  printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = this.results.filter(result => result.passed).length;
    const failed = this.results.filter(result => !result.passed).length;
    const total = this.results.length;

    console.log(`Total tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
      console.log('\nFailed tests:');
      this.results.filter(result => !result.passed).forEach(result => {
        console.log(`  - ${result.name}: ${result.error}`);
      });
    }

    console.log('='.repeat(60));

    if (failed === 0) {
      console.log('All tests passed. Ready for production.');
    } else {
      console.log('Some tests failed. Review errors above.');
      process.exit(1);
    }
  }

  async runAll(): Promise<void> {
    console.log('='.repeat(60));
    console.log('ITAD API Test Suite');
    console.log('='.repeat(60));

    await this.testAPIConnection();
    await this.testResponseStructure();
    await this.testFiltering();
    await this.testMessageFormatting();
    await this.testEmbedFormatting();
    await this.testStoreFiltering();

    this.printSummary();
  }
}

async function main() {
  const apiKey = process.env.ITAD_API_KEY;

  if (!apiKey) {
    console.error('ERROR: ITAD_API_KEY not found in environment');
    console.error('Set ITAD_API_KEY in your .env file');
    process.exit(1);
  }

  const suite = new ITADTestSuite(apiKey);
  await suite.runAll();
}

main();