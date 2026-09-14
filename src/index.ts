import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import dotenv from "dotenv";
import fs from "node:fs";
import { loadConfig } from "./config/load";
import type { BotConfig } from "./config/schema";
import type { Deal } from "./core/deal";
import { formatRunReport, runPipeline } from "./core/pipeline";
import { ITADApi } from "./services/ITADApi";
import { JsonStateStore } from "./state/jsonStore";

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

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const ITAD_API_KEY = process.env.ITAD_API_KEY;
const TEST_MODE = process.env.TEST_MODE === "true";

let config: BotConfig;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});
const api = new ITADApi(ITAD_API_KEY);
const store = new JsonStateStore("./deal-history.json", config.dedupeTtlDays);

async function run(): Promise<void> {
  console.log(`Mode: ${TEST_MODE ? "TEST (console only)" : "LIVE (Discord)"}`);
  console.log(
    `country=${config.country} shops=${config.shopIds.join(",")} limit=${config.limit}`,
  );

  let sendEmbeds: ((batch: Deal[]) => Promise<void>) | undefined;
  if (!TEST_MODE) {
    const channel = (await client.channels.fetch(CHANNEL_ID)) as TextChannel;
    sendEmbeds = async (batch) => {
      await channel.send({
        embeds: batch.map((deal) =>
          api.formatDealEmbed(deal, config.filters.nearLowPercent),
        ),
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
    };
  }

  const report = await runPipeline({ api, store, config, sendEmbeds });
  const summary = formatRunReport(report);
  console.log(summary);

  if (TEST_MODE) {
    for (const [i, deal] of report.posted.entries()) {
      console.log(
        `\n**${i + 1}.** ${deal.title}\n\n${api.formatDealMessage(deal, config.filters.nearLowPercent)}`,
      );
    }
  }

  const githubSummary = process.env.GITHUB_STEP_SUMMARY;
  if (githubSummary) {
    fs.appendFileSync(
      githubSummary,
      `## Dealbot\n\n\`\`\`\n${summary}\n\`\`\`\n`,
    );
  }
}

async function main(): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
  process.exit(0);
}

if (TEST_MODE) {
  void main();
} else {
  client.once("clientReady", () => {
    console.log(`Logged in as ${client.user?.tag}`);
    void main();
  });
  client.login(DISCORD_TOKEN);
}
