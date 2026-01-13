import { getCachedDeals, api } from '../fixtures/itadFixture';

describe('Sanitization / escaping', () => {
  jest.setTimeout(20000);

  test('formatted message and embed avoid raw mentions and mass-ping tokens', async () => {
    const deals = await getCachedDeals();
    expect(deals.length).toBeGreaterThan(0);

    const deal = deals[0];
    const message = api.formatDealMessage(deal);

    // Disallow mass pings and raw mention tokens
    expect(message).not.toMatch(/@everyone/);
    expect(message).not.toMatch(/@here/);
    expect(message).not.toMatch(/<@!?\d+>/); // no user mentions
    expect(message).not.toMatch(/<@&\d+>/); // no role mentions

    // Embed title/description should also avoid raw mentions
    const embed = api.formatDealEmbed(deal as any);
    const json = (embed as any).toJSON ? (embed as any).toJSON() : embed;

    const title = String(json.title || '');
    const desc = String(json.description || '');

    expect(title).not.toMatch(/@everyone/);
    expect(title).not.toMatch(/@here/);
    expect(title).not.toMatch(/<@!?\d+>/);
    expect(title).not.toMatch(/<@&\d+>/);

    expect(desc).not.toMatch(/@everyone/);
    expect(desc).not.toMatch(/@here/);
    expect(desc).not.toMatch(/<@!?\d+>/);
    expect(desc).not.toMatch(/<@&\d+>/);
  });
});
