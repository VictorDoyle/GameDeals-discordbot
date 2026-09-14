import { mapItadDeal } from "../../src/core/deal";
import { api, getCachedDeals } from "../fixtures/itadFixture";

describe("Sanitization / escaping", () => {
  test("formatted message and embed avoid raw mentions and mass-ping tokens", async () => {
    const deals = (await getCachedDeals()).map(mapItadDeal);
    expect(deals.length).toBeGreaterThan(0);

    const deal = deals[0];
    const message = api.formatDealMessage(deal);

    expect(message).not.toMatch(/@everyone/);
    expect(message).not.toMatch(/@here/);
    expect(message).not.toMatch(/<@!?\d+>/);
    expect(message).not.toMatch(/<@&\d+>/);

    const embed = api.formatDealEmbed(deal);
    const json = embed.toJSON();

    const title = String(json.title || "");
    const desc = String(json.description || "");

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
