import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import { CheapSharkAPI } from './services/apiCall';
import { DeduplicationService } from './services/deduplication';
import { ApiConfig } from './types';

dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const DEAL_LIMIT = parseInt(process.env.DEAL_LIMIT || '20');

const SORT_BY = (process.env.SORT_BY as ApiConfig['sortBy']) || 'Savings';
const UPPER_PRICE = process.env.UPPER_PRICE ? parseFloat(process.env.UPPER_PRICE) : undefined;
const LOWER_PRICE = process.env.LOWER_PRICE ? parseFloat(process.env.LOWER_PRICE) : undefined;
const MIN_METACRITIC = process.env.MIN_METACRITIC ? parseInt(process.env.MIN_METACRITIC) : undefined;
const MIN_STEAM_RATING = process.env.MIN_STEAM_RATING ? parseInt(process.env.MIN_STEAM_RATING) : undefined;
const MIN_REVIEW_COUNT = process.env.MIN_REVIEW_COUNT ? parseInt(process.env.MIN_REVIEW_COUNT) : undefined;
const ON_SALE = process.env.ON_SALE === 'true';
const STORE_IDS = process.env.STORE_ID ? process.env.STORE_ID.split(',').map(id => parseInt(id.trim())) : [];
const DEALS_PER_STORE = parseInt(process.env.DEALS_PER_STORE || '3');
const MIN_SAVINGS = process.env.MIN_SAVINGS ? parseInt(process.env.MIN_SAVINGS) : 35;
const FETCH_GAME_DETAILS = process.env.FETCH_GAME_DETAILS === 'true';
const DEDUPLICATION_DAYS = parseInt(process.env.DEDUPLICATION_DAYS || '7');

if (!DISCORD_TOKEN || !CHANNEL_ID) {
  console.error('Missing required environment variables: DISCORD_TOKEN or DISCORD_CHANNEL_ID');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

const deduplicationService = new DeduplicationService('./deal-history.json', DEDUPLICATION_DAYS);

async function postDeals() {
  try {
    console.log(`Deal limit: ${DEAL_LIMIT}`);
    console.log(`Minimum savings: ${MIN_SAVINGS}%`);

    const apiConfig: ApiConfig = {
      sortBy: SORT_BY,
      desc: true,
      upperPrice: UPPER_PRICE,
      lowerPrice: LOWER_PRICE,
      metacritic: MIN_METACRITIC,
      steamRating: MIN_STEAM_RATING,
      minReviewCount: MIN_REVIEW_COUNT,
      onSale: ON_SALE,
      pageSize: 60
    };

    console.log('API Config:', apiConfig);
    if (STORE_IDS.length > 0) {
      console.log(`Stores: ${STORE_IDS.join(', ')} (${DEALS_PER_STORE} deals per store)`);
    }

    const api = new CheapSharkAPI();
    const stores = await api.getStores();
    console.log(`Loaded ${stores.size} store names`);

    let deals;

    if (STORE_IDS.length > 0) {
      deals = await api.getDealsFromMultipleStores(
        apiConfig,
        STORE_IDS,
        DEALS_PER_STORE,
        MIN_SAVINGS,
        FETCH_GAME_DETAILS
      );
    } else {
      if (FETCH_GAME_DETAILS) {
        deals = await api.getDealsWithGameDetails(apiConfig, DEAL_LIMIT, MIN_SAVINGS);
      } else {
        deals = await api.getDeals(apiConfig, DEAL_LIMIT);
        deals = deals.filter(deal => parseFloat(deal.savings) >= MIN_SAVINGS);
      }
    }

    console.log(`Found ${deals.length} deals before deduplication`);

    const newDeals = deduplicationService.filterNewDeals(deals);
    console.log(`${newDeals.length} new deals after deduplication`);

    if (newDeals.length === 0) {
      console.log('No new deals found matching the criteria');
      const channel = await client.channels.fetch(CHANNEL_ID ?? '') as TextChannel;
      await channel.send('No new game deals found today matching your filters.');
      return;
    }

    const stats = deduplicationService.getStats();
    console.log(`Deal history stats: ${stats.totalDeals} total deals tracked`);

    const channel = await client.channels.fetch(CHANNEL_ID ?? '') as TextChannel;

    for (let i = 0; i < newDeals.length; i++) {
      const deal = newDeals[i];
      const message = api.formatDealMessage(deal, stores);

      await channel.send(message);
      console.log(`Posted deal ${i + 1}/${newDeals.length}: ${deal.title}`);

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    deduplicationService.markDealsAsPosted(newDeals);

    console.log('All deals posted successfully');
  } catch (error) {
    console.error('Error posting deals:', error);
    throw error;
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}`);
  console.log(`Posting deals to channel: ${CHANNEL_ID}`);

  try {
    await postDeals();
  } catch (error) {
    console.error('Failed to post deals:', error);
    process.exit(1);
  }

  console.log('Job completed, exiting...');
  process.exit(0);
});

client.login(DISCORD_TOKEN);