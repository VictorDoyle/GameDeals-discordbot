import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
} catch {
  // no .env file
}

const apiKey = process.env.ITAD_API_KEY;
if (!apiKey) {
  console.error("ITAD_API_KEY is required to record fixtures");
  process.exit(1);
}

const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../tests/fixtures/itad",
);

function redact(value) {
  const json = JSON.stringify(value).replaceAll(apiKey, "[REDACTED]");
  if (json.includes(apiKey)) {
    throw new Error("API key still present after redact");
  }
  return JSON.parse(json);
}

async function itadJson(path) {
  const response = await fetch(`https://api.isthereanydeal.com${path}`, {
    headers: { "ITAD-API-Key": apiKey },
  });
  if (!response.ok) {
    throw new Error(`ITAD ${path} failed: ${response.status}`);
  }
  return response.json();
}

const deals = await itadJson(
  "/deals/v2?country=US&offset=0&limit=10&sort=-cut&nondeals=false&mature=false",
);
writeFileSync(
  join(outDir, "deals-v2.json"),
  `${JSON.stringify(redact(deals), null, 2)}\n`,
);

const list = deals.list ?? [];
const infoById = {};
for (const deal of list.slice(0, 5)) {
  infoById[deal.id] = await itadJson(
    `/games/info/v2?id=${encodeURIComponent(deal.id)}`,
  );
}
writeFileSync(
  join(outDir, "games-info-v2.json"),
  `${JSON.stringify(redact(infoById), null, 2)}\n`,
);

console.log(`Wrote fixtures to ${outDir}`);
