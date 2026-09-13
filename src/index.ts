import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import dotenv from "dotenv";
import { parseIntegerEnv, parseShopIds } from "./env";
import { sendDealBatches } from "./posting";
import { DealCollector } from "./services/dealCollector";
import {
  createDealMatcher,
  parseDrmNamesFromEnv,
} from "./services/dealFilters";
import { DeduplicationService } from "./services/deduplication";
import { GAME_INFO_BUDGET, ITADApi } from "./services/ITADApi";
import { ITADConfig, ITADDeal } from "./types";

dotenv.config();

if (
  !process.env.DISCORD_TOKEN ||
  !process.env.DISCORD_CHANNEL_ID ||
  !process.env.ITAD_API_KEY
) {
  console.error(
    "Missing required environment variables: DISCORD_TOKEN, DISCORD_CHANNEL_ID, or ITAD_API_KEY",
  );
  process.exit(1);
}

const DISCORD_TOKEN: string = process.env.DISCORD_TOKEN;
const CHANNEL_ID: string = process.env.DISCORD_CHANNEL_ID;
const ITAD_API_KEY: string = process.env.ITAD_API_KEY;

let DEAL_LIMIT: number;
let MIN_SAVINGS: number;
let MAX_SAVINGS: number;
let DEDUPLICATION_DAYS: number;
let SHOP_IDS: number[];
let MIN_HOURS_UNTIL_EXPIRY: number;
let MIN_RATING: number;
let MIN_REVIEW_COUNT: number;

try {
  DEAL_LIMIT = parseIntegerEnv("DEAL_LIMIT", process.env.DEAL_LIMIT, 50, 1);
  MIN_SAVINGS = parseIntegerEnv("MIN_SAVINGS", process.env.MIN_SAVINGS, 30, 0);
  MAX_SAVINGS = parseIntegerEnv("MAX_SAVINGS", process.env.MAX_SAVINGS, 85, 0);
  DEDUPLICATION_DAYS = parseIntegerEnv(
    "DEDUPLICATION_DAYS",
    process.env.DEDUPLICATION_DAYS,
    7,
    1,
  );
  MIN_HOURS_UNTIL_EXPIRY = parseIntegerEnv(
    "MIN_HOURS_UNTIL_EXPIRY",
    process.env.MIN_HOURS_UNTIL_EXPIRY,
    48,
    0,
  );
  MIN_RATING = parseIntegerEnv("MIN_RATING", process.env.MIN_RATING, 70, 0);
  MIN_REVIEW_COUNT = parseIntegerEnv(
    "MIN_REVIEW_COUNT",
    process.env.MIN_REVIEW_COUNT,
    100,
    0,
  );
  SHOP_IDS = parseShopIds(process.env.SHOP_IDS);
  if (MIN_SAVINGS > MAX_SAVINGS) {
    throw new Error(
      `MIN_SAVINGS (${MIN_SAVINGS}) must be <= MAX_SAVINGS (${MAX_SAVINGS})`,
    );
  }
  if (MIN_RATING > 100) {
    throw new Error(
      `MIN_RATING must be an integer >= 0, got ${JSON.stringify(process.env.MIN_RATING)}`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const COUNTRY = process.env.COUNTRY || "US";
const TEST_MODE = process.env.TEST_MODE === "true";

const REQUIRED_DRM_NAMES = parseDrmNamesFromEnv(
  process.env.REQUIRED_DRM_NAMES ?? "Steam",
);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const deduplicationService = new DeduplicationService(
  "./deal-history.json",
  DEDUPLICATION_DAYS,
);

async function postDeals() {
  try {
    console.log("=".repeat(60));
    console.log("ITAD Game Deals Bot - Starting...");
    console.log("=".repeat(60));
    console.log(
      `Mode: ${TEST_MODE ? "TEST (Console Only)" : "LIVE (Discord)"}`,
    );
    console.log(`Deal limit: ${DEAL_LIMIT}`);
    console.log(`Min savings: ${MIN_SAVINGS}%`);
    console.log(`Country: ${COUNTRY}`);
    console.log(`Shops: ${SHOP_IDS.join(", ")}`);
    console.log("=".repeat(60));

    const api = new ITADApi(ITAD_API_KEY);

    const pageSize = 200;
    const baseConfig: ITADConfig = {
      country: COUNTRY,
      sort: "-cut",
      shops: SHOP_IDS,
      minSavings: MIN_SAVINGS,
      maxSavings: MAX_SAVINGS,
      limit: pageSize,
    };

    console.log("\n� Configuration:");
    console.log(`   Country: ${COUNTRY}`);
    console.log(`   Shop IDs: ${SHOP_IDS.join(", ")}`);
    console.log(`   Min Savings: ${MIN_SAVINGS}%`);
    console.log(`   Max Savings: ${MAX_SAVINGS}%`);
    console.log(`   Target deals: ${DEAL_LIMIT}`);
    console.log(
      `   Required DRM: ${REQUIRED_DRM_NAMES.length > 0 ? REQUIRED_DRM_NAMES.join(", ") : "any"}`,
    );
    console.log(`   Min hours until expiry: ${MIN_HOURS_UNTIL_EXPIRY}`);
    console.log(`   Min rating: ${MIN_RATING}`);
    console.log(`   Min review count: ${MIN_REVIEW_COUNT}`);

    const collectMatcher = createDealMatcher({
      minSavings: MIN_SAVINGS,
      maxSavings: MAX_SAVINGS,
      requiredDrmNames: REQUIRED_DRM_NAMES,
      minHoursUntilExpiry: MIN_HOURS_UNTIL_EXPIRY,
    });

    const ratingFiltersOn = MIN_RATING > 0 || MIN_REVIEW_COUNT > 0;
    const collectTarget = ratingFiltersOn ? GAME_INFO_BUDGET : DEAL_LIMIT;

    console.log("\n📡 Scanning ITAD pages for matching deals...");
    const postedIds = deduplicationService.getPostedDealIds();
    const collector = new DealCollector(
      collectTarget,
      postedIds,
      collectMatcher,
    );

    let offset = 0;
    let pageNumber = 0;

    while (collector.needsMore) {
      if (pageNumber > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const page = await api.fetchDealsPage({ ...baseConfig, offset });
      pageNumber++;

      if (page.list.length === 0) {
        console.log(`Page ${pageNumber}: empty response at offset ${offset}`);
        break;
      }

      for (const deal of page.list) {
        collector.accept(deal);
        if (!collector.needsMore) {
          break;
        }
      }

      const pageStats = collector.stats;
      console.log(
        `Page ${pageNumber}: scanned ${page.list.length} deals at offset ${offset} (accepted ${pageStats.accepted}/${collectTarget})`,
      );

      offset = page.nextOffset;
    }

    let newDeals: ITADDeal[] = collector.results;
    const collectStats = collector.stats;

    console.log(`\n✓ Collection complete`);
    console.log(`   - ITAD results scanned: ${offset}`);
    console.log(`   - Accepted: ${collectStats.accepted}`);
    console.log(`   - Skipped (already posted): ${collectStats.skippedPosted}`);
    console.log(`   - Skipped (filters): ${collectStats.skippedFilter}`);
    console.log(
      `   - Skipped (duplicate in run): ${collectStats.skippedDuplicate}`,
    );

    if (ratingFiltersOn) {
      const enriched = await api.enrichDeals(newDeals, GAME_INFO_BUDGET);
      const skippedUnenriched = newDeals.length - enriched.length;
      const postMatcher = createDealMatcher({
        minSavings: MIN_SAVINGS,
        maxSavings: MAX_SAVINGS,
        requiredDrmNames: REQUIRED_DRM_NAMES,
        minHoursUntilExpiry: MIN_HOURS_UNTIL_EXPIRY,
        minRating: MIN_RATING,
        minReviewCount: MIN_REVIEW_COUNT,
      });
      newDeals = enriched.filter(postMatcher).slice(0, DEAL_LIMIT);
      console.log(
        `   - Enrichment: ${enriched.length} of ${collector.results.length} (skipped ${skippedUnenriched} over budget)`,
      );
      console.log(`   - After rating/review filters: ${newDeals.length}`);
    }

    if (newDeals.length < DEAL_LIMIT) {
      console.warn(
        `Found ${newDeals.length}/${DEAL_LIMIT} new deals after scanning ${offset} ITAD results`,
      );
    }

    if (newDeals.length === 0) {
      console.log("\n No new deals found matching criteria");
      deduplicationService.markDealsAsPosted([]);
      return;
    }

    console.log(`\n📊 Deal Stats:`);
    const stats = deduplicationService.getStats();
    console.log(`   - Total tracked deals: ${stats.totalDeals}`);
    console.log(`   - New deals to post: ${newDeals.length}`);

    if (TEST_MODE) {
      console.log("\n" + "=".repeat(60));
      console.log("TEST MODE - Deals that would be posted:");
      console.log("=".repeat(60));

      const combined = newDeals
        .map(
          (d, i) => `**${i + 1}.** ${d.title}\n\n${api.formatDealMessage(d)}`,
        )
        .join("\n---\n");
      if (combined.length > 0) {
        console.log(combined);
      } else {
        console.log("No new deals to display");
      }

      console.log("=".repeat(60));
      console.log("TEST COMPLETE - No deals posted to Discord");
      console.log("=".repeat(60));

      // Ensure deal history file exists even in test mode
      console.log("💾 Saving deal history file for GitHub Action...");
      deduplicationService.markDealsAsPosted([]);

      return;
    }

    console.log("\n Posting to Discord...");
    const channel = (await client.channels.fetch(CHANNEL_ID)) as TextChannel;

    await sendDealBatches(
      newDeals,
      async (batch) => {
        await channel.send({
          embeds: batch.map((deal) => api.formatDealEmbed(deal)),
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
      },
      (batch) => {
        deduplicationService.markDealsAsPosted(batch);
      },
    );

    console.log("\n" + "=".repeat(60));
    console.log(" All deals posted successfully");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n Error posting deals:", error);
    throw error;
  }
}

client.once("clientReady", async () => {
  if (!TEST_MODE) {
    console.log(` Logged in as ${client.user?.tag}`);
    console.log(` Channel ID: ${CHANNEL_ID}`);
  }

  try {
    await postDeals();
  } catch (error) {
    console.error("\n Fatal error:", error);
    process.exit(1);
  }

  console.log("\n Job completed, exiting...");
  process.exit(0);
});

if (TEST_MODE) {
  console.log(" TEST_MODE enabled - skipping Discord login\n");
  postDeals()
    .then(() => {
      console.log("\n Test completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n Test failed:", error);
      process.exit(1);
    });
} else {
  client.login(DISCORD_TOKEN);
}
