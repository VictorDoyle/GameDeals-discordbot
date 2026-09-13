# Tests

`yarn test` is offline. It runs unit tests in `dealCollector`, `dealFilters`, and `getDealsFilter`. Live ITAD files are skipped unless you opt in.

```bash
yarn test
```

## Live ITAD tests (opt-in)

These hit `/deals/v2` once per run via `tests/fixtures/itadFixture.ts`. They need a key and `ITAD_LIVE=1`. Make sure to read the latest rate limits from ITAD service here: [ITAD Rate Limiting](https://docs.isthereanydeal.com/#section/Rate-Limiting)

```bash
ITAD_LIVE=1 yarn test
```

`.env` needs `ITAD_API_KEY`. `SHOP_IDS` is optional.

Live files: `apiConnection`, `responseStructure`, `filtering`, `storeFiltering`, `messageFormatting`, `embedFormatting`, `format/sanitization`.

`tests/base.ts` is a standalone smoke script, not a Jest file:

```bash
yarn ts-node tests/base.ts
```
