import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import { CheapSharkAPI } from './services/apiCall';
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

async function postDeals() {
  try {
    console.log('Fetching deals from CheapShark API...');
    console.log(`Deal limit: ${DEAL_LIMIT}`);

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
    let deals;

    if (STORE_IDS.length > 0) {
      deals = await api.getDealsFromMultipleStores(apiConfig, STORE_IDS, DEALS_PER_STORE);
    } else {
      deals = await api.getDeals(apiConfig, DEAL_LIMIT);
    }

    if (deals.length === 0) {
      console.log('No deals found matching the criteria');
      const channel = await client.channels.fetch(CHANNEL_ID ?? '') as TextChannel;
      await channel.send('No game deals found today matching your filters.');
      return;
    }

    console.log(`Found ${deals.length} deals`);

    const channel = await client.channels.fetch(CHANNEL_ID ?? '') as TextChannel;

    for (let i = 0; i < deals.length; i++) {
      const deal = deals[i];
      const message = api.formatDealMessage(deal);

      await channel.send(message);
      console.log(`Posted deal ${i + 1}/${deals.length}: ${deal.title}`);

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

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