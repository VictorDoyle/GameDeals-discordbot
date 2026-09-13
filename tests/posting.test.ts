import { sendDealBatches } from "../src/posting";

describe("sendDealBatches", () => {
  test("marks each successful batch and stops if send throws", async () => {
    const posted: string[][] = [];
    const deals = [{ id: "1" }, { id: "2" }, { id: "3" }];
    let calls = 0;

    await expect(
      sendDealBatches(
        deals,
        async () => {
          calls += 1;
          if (calls === 2) {
            throw new Error("discord down");
          }
        },
        (batch) => {
          posted.push(batch.map((deal) => deal.id));
        },
        2,
      ),
    ).rejects.toThrow("discord down");

    expect(posted).toEqual([["1", "2"]]);
  });
});
