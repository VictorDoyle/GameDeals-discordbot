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
        shops: [61, 35, 6]
      });

      const minSavings = 30;
      const minReviewCount = 150;

      console.log(`Total deals fetched: ${deals.length}`);

      const filtered = this.api.filterDeals(deals, minSavings, minReviewCount);

      console.log(`Deals after filtering: ${filtered.length}`);

      if (filtered.length === 0) {
        console.log('WARNING: No deals passed filters. This may indicate:');
        console.log('  - Filters are too strict');
        console.log('  - No Steam deals with sufficient reviews currently available');
        console.log('  - Consider lowering MIN_SAVINGS or MIN_REVIEW_COUNT');
        this.pass('Filtering (no results but function works)');
        return;
      }

      let allPassedSavings = true;
      let allPassedReviews = true;
      let allHaveSteamDRM = true;

      for (const deal of filtered) {
        if (deal.deal.cut < minSavings) {
          allPassedSavings = false;
          console.log(`  Failed savings: ${deal.title} - ${deal.deal.cut}%`);
        }

        const steamReview = deal.reviews?.find(review => review.source === 'Steam');
        if (!steamReview || steamReview.count < minReviewCount) {
          allPassedReviews = false;
          console.log(`  Failed reviews: ${deal.title} - ${steamReview?.count || 0} reviews`);
        }

        const hasSteamDRM = deal.deal.drm?.some(drmInfo => drmInfo.name === 'Steam');
        if (!hasSteamDRM) {
          allHaveSteamDRM = false;
          console.log(`  Failed DRM: ${deal.title} - No Steam DRM`);
        }
      }

      if (allPassedSavings) {
        this.pass(`Savings filter (min ${minSavings}%)`);
      } else {
        this.fail(`Savings filter`, 'Some deals below minimum savings');
      }

      if (allPassedReviews) {
        this.pass(`Review count filter (min ${minReviewCount})`);
      } else {
        this.fail(`Review count filter`, 'Some deals below minimum reviews');
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