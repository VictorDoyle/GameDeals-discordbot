import { defineConfig } from "../src/config/defineConfig";

export default defineConfig({
  region: { country: "US" },
  stores: ["steam", "gog", "fanatical", 3],
  filters: {
    minDiscount: 30,
    maxDiscount: 85,
    minRating: 70,
    minReviews: 100,
    drm: "Steam",
    minHoursUntilExpiry: 48,
  },
  limit: 50,
  dedupe: { ttlDays: 7 },
});
