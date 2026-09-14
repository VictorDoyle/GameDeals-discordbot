import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config/load";
import { parseBotConfig } from "../src/config/schema";

function tmpCwd(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dealbot-config-"));
}

describe("parseBotConfig", () => {
  test("example defaults match today's env defaults", () => {
    const config = parseBotConfig({});
    expect(config.country).toBe("US");
    expect(config.shopIds).toEqual([61, 35, 6, 3]);
    expect(config.limit).toBe(50);
    expect(config.filters).toEqual({
      minDiscount: 30,
      maxDiscount: 85,
      minRating: 70,
      minReviews: 100,
      drmNames: ["Steam"],
      minHoursUntilExpiry: 48,
    });
    expect(config.dedupeTtlDays).toBe(7);
  });

  test("invalid config fails with a path in the message", () => {
    expect(() => parseBotConfig({ filters: { minRating: "seventy" } })).toThrow(
      'filters.minRating must be 0–100, got "seventy"',
    );
  });

  test("store names resolve to ITAD shop ids", () => {
    const config = parseBotConfig({ stores: ["steam", "gog"] });
    expect(config.shopIds).toEqual([61, 35]);
  });
});

describe("loadConfig", () => {
  test("DEALBOT__FILTERS__MIN_DISCOUNT overrides the file", () => {
    const cwd = tmpCwd();
    fs.writeFileSync(
      path.join(cwd, "bot.config.ts"),
      `export default { filters: { minDiscount: 30 } };\n`,
    );

    const config = loadConfig(cwd, {
      DEALBOT__FILTERS__MIN_DISCOUNT: "40",
    });
    expect(config.filters.minDiscount).toBe(40);
  });

  test("missing bot.config.ts falls back to example.config.ts", () => {
    const cwd = tmpCwd();
    fs.mkdirSync(path.join(cwd, "config"));
    fs.copyFileSync(
      path.join(process.cwd(), "config/example.config.ts"),
      path.join(cwd, "config/example.config.ts"),
    );

    const config = loadConfig(cwd, {});
    expect(config.shopIds).toEqual([61, 35, 6, 3]);
    expect(config.limit).toBe(50);
  });
});
