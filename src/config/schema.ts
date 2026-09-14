import { z } from "zod";
import { resolveShopId } from "./shops";

const DEFAULT_STORES: Array<string | number> = ["steam", "gog", "fanatical", 3];

function intAtLeast(min: number) {
  return z.unknown().transform((value, ctx) => {
    if (typeof value === "number" && Number.isInteger(value) && value >= min) {
      return value;
    }
    ctx.addIssue({
      code: "custom",
      message: `must be an integer >= ${min}, got ${JSON.stringify(value)}`,
    });
    return z.NEVER;
  });
}

function intRange(min: number, max: number) {
  return z.unknown().transform((value, ctx) => {
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= min &&
      value <= max
    ) {
      return value;
    }
    ctx.addIssue({
      code: "custom",
      message: `must be ${min}–${max}, got ${JSON.stringify(value)}`,
    });
    return z.NEVER;
  });
}

const filtersSchema = z.object({
  minDiscount: intRange(0, 100).default(30),
  maxDiscount: intRange(0, 100).default(85),
  minRating: intRange(0, 100).default(70),
  minReviews: intAtLeast(0).default(100),
  drm: z.union([z.string(), z.array(z.string())]).default("Steam"),
  minHoursUntilExpiry: intAtLeast(0).default(48),
  includeFree: z.boolean().default(false),
  minPrice: z.number().nonnegative().nullish(),
  maxPrice: z.number().nonnegative().nullish(),
  nearLowPercent: intRange(0, 100).default(5),
});

const botConfigSchema = z.object({
  region: z
    .object({ country: z.string().min(1).default("US") })
    .default({ country: "US" }),
  stores: z
    .array(z.union([z.string(), z.number()]))
    .min(1)
    .default(DEFAULT_STORES),
  filters: filtersSchema.default({
    minDiscount: 30,
    maxDiscount: 85,
    minRating: 70,
    minReviews: 100,
    drm: "Steam",
    minHoursUntilExpiry: 48,
    includeFree: false,
    nearLowPercent: 5,
  }),
  limit: intAtLeast(1).default(50),
  source: z.enum(["deals", "giveaways"]).default("deals"),
  dedupe: z
    .object({ ttlDays: intAtLeast(1).default(7) })
    .default({ ttlDays: 7 }),
});

export type BotConfigInput = z.input<typeof botConfigSchema>;

export type BotConfig = {
  country: string;
  shopIds: number[];
  limit: number;
  source: "deals" | "giveaways";
  filters: {
    minDiscount: number;
    maxDiscount: number;
    minRating: number;
    minReviews: number;
    drmNames: string[];
    minHoursUntilExpiry: number;
    includeFree: boolean;
    minPrice: number | null;
    maxPrice: number | null;
    nearLowPercent: number;
  };
  dedupeTtlDays: number;
};

export function defineConfig(config: BotConfigInput): BotConfigInput {
  return config;
}

function drmNames(drm: string | string[]): string[] {
  if (Array.isArray(drm)) {
    return drm.map((name) => name.trim()).filter((name) => name.length > 0);
  }
  const trimmed = drm.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === "any") {
    return [];
  }
  return trimmed
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

export function formatConfigError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "(root)";
      return `${path} ${issue.message}`;
    })
    .join("\n");
}

export function parseBotConfig(input: unknown): BotConfig {
  const result = botConfigSchema.safeParse(input ?? {});
  if (!result.success) {
    throw new Error(formatConfigError(result.error));
  }

  const data = result.data;
  if (data.filters.minDiscount > data.filters.maxDiscount) {
    throw new Error(
      `filters.minDiscount (${data.filters.minDiscount}) must be <= filters.maxDiscount (${data.filters.maxDiscount})`,
    );
  }

  if (
    data.filters.minPrice != null &&
    data.filters.maxPrice != null &&
    data.filters.minPrice > data.filters.maxPrice
  ) {
    throw new Error(
      `filters.minPrice (${data.filters.minPrice}) must be <= filters.maxPrice (${data.filters.maxPrice})`,
    );
  }

  return {
    country: data.region.country,
    shopIds: data.stores.map(resolveShopId),
    limit: data.limit,
    source: data.source,
    filters: {
      minDiscount: data.filters.minDiscount,
      maxDiscount: data.filters.maxDiscount,
      minRating: data.filters.minRating,
      minReviews: data.filters.minReviews,
      drmNames: drmNames(data.filters.drm),
      minHoursUntilExpiry: data.filters.minHoursUntilExpiry,
      includeFree: data.filters.includeFree ?? false,
      minPrice: data.filters.minPrice ?? null,
      maxPrice: data.filters.maxPrice ?? null,
      nearLowPercent: data.filters.nearLowPercent ?? 5,
    },
    dedupeTtlDays: data.dedupe.ttlDays,
  };
}
