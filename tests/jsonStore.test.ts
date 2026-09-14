import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { JsonStateStore } from "../src/state/jsonStore";

function tmpHistory(): string {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "dealbot-state-")),
    "deal-history.json",
  );
}

describe("JsonStateStore", () => {
  test("crash between temp write and rename leaves the old file intact", () => {
    const filePath = tmpHistory();
    const store = new JsonStateStore(filePath, 7);
    store.markPosted([{ id: "old" }]);
    const before = fs.readFileSync(filePath, "utf8");

    const rename = vi.spyOn(fs, "renameSync").mockImplementation(() => {
      throw new Error("crash");
    });

    expect(() => store.markPosted([{ id: "new" }])).toThrow("crash");
    expect(fs.readFileSync(filePath, "utf8")).toBe(before);
    rename.mockRestore();
  });

  test("compaction drops expired ids", () => {
    const filePath = tmpHistory();
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        postedDeals: {
          stale: Date.now() - 8 * 24 * 60 * 60 * 1000,
          fresh: Date.now(),
        },
      }),
    );

    const store = new JsonStateStore(filePath, 7);
    store.markPosted([{ id: "next" }]);

    const saved = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      postedDeals: Record<string, number>;
    };
    expect(saved.postedDeals.stale).toBeUndefined();
    expect(saved.postedDeals.fresh).toBeDefined();
    expect(saved.postedDeals.next).toBeDefined();
  });

  test("postedIds does not rewrite the file", () => {
    const filePath = tmpHistory();
    fs.writeFileSync(filePath, JSON.stringify({ postedDeals: { a: Date.now() } }));
    const before = fs.readFileSync(filePath, "utf8");

    const store = new JsonStateStore(filePath, 7);
    expect(store.postedIds()).toEqual(new Set(["a"]));
    expect(fs.readFileSync(filePath, "utf8")).toBe(before);
  });
});
