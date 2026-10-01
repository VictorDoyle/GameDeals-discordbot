# Tests

`yarn test` is offline. MSW serves recorded fixtures from `tests/fixtures/itad/`.

```bash
yarn test
```

## Record fixtures

Needs `ITAD_API_KEY`. Strips the key from the written JSON.

```bash
yarn fixtures:record
```

## Live ITAD (opt-in)

Skip MSW and hit the real API:

```bash
ITAD_LIVE=1 yarn test
```

`tests/base.ts` is a standalone smoke script, not part of `yarn test`:

```bash
yarn ts-node tests/base.ts
```
