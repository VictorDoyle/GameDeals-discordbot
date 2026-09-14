import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseBotConfig } from "../src/config/schema";
import { runPipeline } from "../src/core/pipeline";
import { ITADApi } from "../src/services/ITADApi";
import { JsonStateStore } from "../src/state/jsonStore";

describe("runPipeline", () => {
  test("fixture pipeline posts expected ids and counts rejects", async () => {
    const history = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "dealbot-pipe-")),
      "deal-history.json",
    );
    const posted: string[][] = [];
    const report = await runPipeline({
      api: new ITADApi("test-fixture-key"),
      store: new JsonStateStore(history, 7),
      config: parseBotConfig({}),
      sendEmbeds: async (batch) => {
        posted.push(batch.map((deal) => deal.id));
      },
    });

    expect(report.posted.map((deal) => deal.id)).toEqual([
      "018d937f-game-hollow-knight",
    ]);
    expect(posted).toEqual([["018d937f-game-hollow-knight"]]);
    expect(report.rejects.drm).toBe(1);
    expect(report.rejects.rating).toBe(1);
    expect(report.scanned).toBe(3);
  });
});
