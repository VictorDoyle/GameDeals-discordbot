import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import { ITADApi } from './services/ITADApi';
import { DeduplicationService } from './services/deduplication';
import { ITADConfig } from './types';

dotenv.config();

if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CHANNEL_ID || !process.env.ITAD_API_KEY) {
  console.error('Missing required environment variables: DISCORD_TOKEN, DISCORD_CHANNEL_ID, or ITAD_API_KEY');
  process.exit(1);
}

const DISCORD_TOKEN: string = process.env.DISCORD_TOKEN;
const CHANNEL_ID: string = process.env.DISCORD_CHANNEL_ID;
const ITAD_API_KEY: string = process.env.ITAD_API_KEY;

const DEAL_LIMIT = parseInt(process.env.DEAL_LIMIT || '50');
const MIN_SAVINGS = parseInt(process.env.MIN_SAVINGS || '30');
const MAX_SAVINGS = parseInt(process.env.MAX_SAVINGS || '85');

const COUNTRY = process.env.COUNTRY || 'US';
const DEDUPLICATION_DAYS = parseInt(process.env.DEDUPLICATION_DAYS || '7');
const TEST_MODE = process.env.TEST_MODE === 'true';

const SHOP_IDS = process.env.SHOP_IDS
  ? process.env.SHOP_IDS.split(',').map(id => parseInt(id.trim()))
  : [61, 35, 6, 3];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

const deduplicationService = new DeduplicationService('./deal-history.json', DEDUPLICATION_DAYS);

async function postDeals() {
  try {
    console.log('='.repeat(60));
    console.log('ITAD Game Deals Bot - Starting...');
    console.log('='.repeat(60));
    console.log(`Mode: ${TEST_MODE ? 'TEST (Console Only)' : 'LIVE (Discord)'}`);
    console.log(`Deal limit: ${DEAL_LIMIT}`);
    console.log(`Min savings: ${MIN_SAVINGS}%`);
    console.log(`Country: ${COUNTRY}`);
    console.log(`Shops: ${SHOP_IDS.join(', ')}`);
    console.log('='.repeat(60));

    const api = new ITADApi(ITAD_API_KEY);

    const config: ITADConfig = {
      country: COUNTRY,
      offset: 0,
      limit: 200,
      sort: '-cut',
      shops: SHOP_IDS
    };

    console.log('\n📡 Fetching deals from ITAD API...');
    let allDeals = await api.getDeals(config);
    console.log(`✓ Fetched ${allDeals.length} raw deals from ITAD`);

    console.log('\n🔍 Applying filters...');
    let filteredDeals = api.filterDeals(
      allDeals,
      MIN_SAVINGS,
      MAX_SAVINGS
    );
    console.log(`✓ ${filteredDeals.length} deals after filtering`);

    filteredDeals = filteredDeals.slice(0, DEAL_LIMIT);

    console.log('\n🔄 Checking for duplicates...');
    const newDeals = deduplicationService.filterNewDeals(filteredDeals);
    console.log(`✓ ${newDeals.length} new deals after deduplication`);

    if (newDeals.length === 0) {
      console.log('\n⚠️  No new deals found matching criteria');

      if (!TEST_MODE) {
        const channel = await client.channels.fetch(CHANNEL_ID) as TextChannel;
        await channel.send('No new game deals found today matching your filters.');
      }
      return;
    }

    console.log(`\n📊 Deal Stats:`);
    const stats = deduplicationService.getStats();
    console.log(`   - Total tracked deals: ${stats.totalDeals}`);
    console.log(`   - New deals to post: ${newDeals.length}`);

    if (TEST_MODE) {
      console.log('\n' + '='.repeat(60));
      console.log('TEST MODE - Deals that would be posted:');
      console.log('='.repeat(60));

      newDeals.forEach((deal, index) => {
        console.log(`\n[${index + 1}/${newDeals.length}] ${deal.title}`);
        console.log('-'.repeat(60));
        const message = api.formatDealMessage(deal);
        console.log(message);
      });

      console.log('='.repeat(60));
      console.log('✓ TEST COMPLETE - No deals posted to Discord');
      console.log('='.repeat(60));
      return;
    }

    console.log('\n Posting to Discord...');
    const channel = await client.channels.fetch(CHANNEL_ID) as TextChannel;

    for (let i = 0; i < newDeals.length; i++) {
      const deal = newDeals[i];
      const message = api.formatDealMessage(deal);

      await channel.send(message);
      console.log(`   ✓ [${i + 1}/${newDeals.length}] ${deal.title}`);

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    deduplicationService.markDealsAsPosted(newDeals);

    console.log('\n' + '='.repeat(60));
    console.log('✓ All deals posted successfully');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Error posting deals:', error);
    throw error;
  }
}

client.once('ready', async () => {
  if (!TEST_MODE) {
    console.log(`✓ Logged in as ${client.user?.tag}`);
    console.log(`✓ Channel ID: ${CHANNEL_ID}`);
  }

  try {
    await postDeals();
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }

  console.log('\n✓ Job completed, exiting...');
  process.exit(0);
});

if (TEST_MODE) {
  console.log(' TEST_MODE enabled - skipping Discord login\n');
  postDeals().then(() => {
    console.log('\n✓ Test completed successfully');
    process.exit(0);
  }).catch((error) => {
    console.error('\n Test failed:', error);
    process.exit(1);
  });
} else {
  client.login(DISCORD_TOKEN);
}