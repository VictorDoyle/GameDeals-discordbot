import fs from "node:fs";
import path from "node:path";

const SIZE_WARN_BYTES = 1_000_000;

type PostedState = {
  postedDeals: Record<string, number>;
};

export class JsonStateStore {
  private posted: Record<string, number> = {};
  private loaded = false;

  constructor(
    private readonly filePath: string,
    private readonly ttlDays: number,
  ) {}

  postedIds(): Set<string> {
    this.ensureLoaded();
    this.prune();
    return new Set(Object.keys(this.posted));
  }

  markPosted(deals: Array<{ id: string }>): void {
    this.ensureLoaded();
    const pruned = this.prune();
    const now = Date.now();
    let added = false;
    for (const deal of deals) {
      this.posted[deal.id] = now;
      added = true;
    }
    if (pruned || added) {
      this.save();
    }
  }

  stats(): { totalDeals: number } {
    this.ensureLoaded();
    this.prune();
    return { totalDeals: Object.keys(this.posted).length };
  }

  private ensureLoaded(): void {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(
          fs.readFileSync(this.filePath, "utf8"),
        ) as PostedState;
        this.posted = parsed.postedDeals ?? {};
      }
    } catch (error) {
      console.error("Error loading deal history:", error);
    }
  }

  private prune(): boolean {
    const cutoff = Date.now() - this.ttlDays * 24 * 60 * 60 * 1000;
    let changed = false;
    for (const [id, timestamp] of Object.entries(this.posted)) {
      if (timestamp <= cutoff) {
        delete this.posted[id];
        changed = true;
      }
    }
    return changed;
  }

  private save(): void {
    const json = `${JSON.stringify({ postedDeals: this.posted }, null, 2)}\n`;
    if (Buffer.byteLength(json) > SIZE_WARN_BYTES) {
      console.warn(
        `deal history is ${Buffer.byteLength(json)} bytes (warn at 1 MB)`,
      );
    }

    const dir = path.dirname(this.filePath);
    const tmp = path.join(
      dir,
      `${path.basename(this.filePath)}.${process.pid}.tmp`,
    );
    fs.writeFileSync(tmp, json, "utf8");
    fs.renameSync(tmp, this.filePath);
  }
}
