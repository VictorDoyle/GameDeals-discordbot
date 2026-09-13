export const DISCORD_EMBED_BATCH = 10;

export async function sendDealBatches<T>(
  deals: T[],
  send: (batch: T[]) => Promise<void>,
  markPosted: (batch: T[]) => void,
  batchSize: number = DISCORD_EMBED_BATCH,
): Promise<void> {
  for (let i = 0; i < deals.length; i += batchSize) {
    const batch = deals.slice(i, i + batchSize);
    await send(batch);
    markPosted(batch);
  }
}
