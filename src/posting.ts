import type { Deal } from "./core/deal";

export const DISCORD_MAX_EMBEDS_PER_MESSAGE = 10; // Discord API cap

export async function postDealBatches(
  deals: Deal[],
  sendEmbeds: (batch: Deal[]) => Promise<void>,
  markPosted: (batch: Deal[]) => void,
): Promise<void> {
  for (let i = 0; i < deals.length; i += DISCORD_MAX_EMBEDS_PER_MESSAGE) {
    const batch = deals.slice(i, i + DISCORD_MAX_EMBEDS_PER_MESSAGE);
    await sendEmbeds(batch);
    markPosted(batch);
  }
}
