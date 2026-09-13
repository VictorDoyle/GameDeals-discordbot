export const DEFAULT_SHOP_IDS = [61, 35, 6, 3];

export function parseIntegerEnv(
  name: string,
  raw: string | undefined,
  fallback: number,
  min: number,
): number {
  if (raw === undefined) {
    if (fallback < min) {
      throw new Error(
        `${name} must be an integer >= ${min}, got ${JSON.stringify(raw)}`,
      );
    }
    return fallback;
  }

  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(
      `${name} must be an integer >= ${min}, got ${JSON.stringify(raw)}`,
    );
  }

  const value = Number(trimmed);
  if (value < min) {
    throw new Error(
      `${name} must be an integer >= ${min}, got ${JSON.stringify(raw)}`,
    );
  }

  return value;
}

export function parseShopIds(
  raw: string | undefined,
  fallback: readonly number[] = DEFAULT_SHOP_IDS,
): number[] {
  if (raw === undefined) {
    return [...fallback];
  }

  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0 || parts.some((part) => !/^\d+$/.test(part))) {
    throw new Error(
      `SHOP_IDS must be a comma-separated list of positive integers, got ${JSON.stringify(raw)}`,
    );
  }

  const ids = parts.map((part) => Number(part));
  if (ids.some((id) => id <= 0)) {
    throw new Error(
      `SHOP_IDS must be a comma-separated list of positive integers, got ${JSON.stringify(raw)}`,
    );
  }

  return ids;
}
